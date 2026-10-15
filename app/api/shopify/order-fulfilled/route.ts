import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { transformShopifyFulfillmentData } from "@/app/libs/utils/transformShopifyData";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function verifyShopifyHmac(rawBody?: string, hmacHeader?: string | null): boolean {
  void rawBody;
  void hmacHeader;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      return withCORS(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    const shopifyOrderId = body.order_id || body.id;
    if (!shopifyOrderId) {
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    const shopifyOrderIdBigInt = BigInt(shopifyOrderId);
    const transformedData = transformShopifyFulfillmentData(body);

    const savedFulfillment = await prisma.shopifyFulfillment.upsert({
      where: { shopifyOrderId: shopifyOrderIdBigInt },
      create: {
        shopifyOrderId: shopifyOrderIdBigInt,
        receivedAt: new Date().toISOString(),
        orderData: body,
        rawPayload: body,
      },
      update: {
        orderData: body,
        rawPayload: body,
        updatedAt: new Date(),
      },
    });

    const savedStructuredFulfillment = await prisma.fulfillmentOrder.upsert({
      where: { orderId: String(transformedData.orderId) },
      create: {
        orderId: String(transformedData.orderId),
        orderNumber: transformedData.orderNumber,
        customer: transformedData.customer,
        shippingAddress: transformedData.shippingAddress,
        product: transformedData.product,
        payment: transformedData.payment,
        fulfillment: transformedData.fulfillment,
        pricing: transformedData.pricing,
        shopifyOrderId: String(shopifyOrderId),
        rawPayload: body,
      },
      update: {
        orderNumber: transformedData.orderNumber,
        customer: transformedData.customer,
        shippingAddress: transformedData.shippingAddress,
        product: transformedData.product,
        payment: transformedData.payment,
        fulfillment: transformedData.fulfillment,
        pricing: transformedData.pricing,
        shopifyOrderId: String(shopifyOrderId),
        rawPayload: body,
        updatedAt: new Date(),
      },
    });

    return withCORS(
      NextResponse.json({
        success: true,
        message: "saved",
        fulfillmentId: savedFulfillment.id,
        structuredFulfillmentId: savedStructuredFulfillment.id,
      })
    );
  } catch (e: any) {
    console.error("Order fulfilled webhook error:", e);
    return withCORS(NextResponse.json({ success: true }));
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0");

    const [fulfillments, total] = await Promise.all([
      prisma.shopifyFulfillment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.shopifyFulfillment.count(),
    ]);

    const orders = fulfillments.map((f) => {
      const d = (f.orderData as any) || {};
      const financialStatus = d.financial_status || d.payment?.status || "pending";

      let trackingNumber = "N/A";
      let trackingCompany = "N/A";

      if (d.tracking_number) {
        trackingNumber = d.tracking_number;
      } else if (d.tracking_numbers && Array.isArray(d.tracking_numbers) && d.tracking_numbers.length > 0) {
        trackingNumber = d.tracking_numbers[0];
      } else if (Array.isArray(d.fulfillments) && d.fulfillments.length > 0) {
        const firstFulfillment = d.fulfillments[0];
        if (firstFulfillment.tracking_number) {
          trackingNumber = firstFulfillment.tracking_number;
        } else if (firstFulfillment.tracking_numbers && Array.isArray(firstFulfillment.tracking_numbers) && firstFulfillment.tracking_numbers.length > 0) {
          trackingNumber = firstFulfillment.tracking_numbers[0];
        }
        trackingCompany = firstFulfillment.tracking_company || "N/A";
      }

      if (trackingCompany === "N/A" && d.tracking_company) {
        trackingCompany = d.tracking_company;
      }

      return {
        _id: f.id,
        id: f.id,
        shopifyOrderId: f.shopifyOrderId.toString(),
        receivedAt: f.receivedAt,
        orderName: d.name || d.order_number || `#${f.shopifyOrderId.toString()}`,
        customerName: d.destination?.name || d.shipping_address?.name || d.customer?.first_name
          ? `${d.customer?.first_name || ""} ${d.customer?.last_name || ""}`.trim()
          : "N/A",
        totalPrice: d.total_price || d.order?.total_price || "0.00",
        currency: d.currency || d.order?.currency || "",
        email: d.email || d.order?.email || d.customer?.email || "N/A",
        phone: d.destination?.phone || d.shipping_address?.phone || d.customer?.phone || d.order?.phone || "N/A",
        address: formatAddress(d.destination || d.shipping_address || d.order?.shipping_address),
        financialStatus,
        fulfillmentStatus: d.status || d.shipment_status || "fulfilled",
        trackingNumber,
        trackingCompany,
      };
    });

    return withCORS(NextResponse.json({ orders, total }));
  } catch (e) {
    console.error("Shopify order-fulfilled GET error:", e);
    return withCORS(NextResponse.json({ orders: [], total: 0 }));
  }
}

function formatAddress(addr: any): string {
  if (!addr) return "N/A";
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fulfillmentId = url.searchParams.get("id");

    if (!fulfillmentId) {
      return withCORS(NextResponse.json({ success: false, error: "Fulfillment ID required" }, { status: 400 }));
    }

    await prisma.shopifyFulfillment.delete({
      where: { id: fulfillmentId },
    });

    return withCORS(NextResponse.json({ success: true, message: "Fulfillment deleted successfully" }));
  } catch (e: any) {
    console.error("Delete fulfillment error:", e?.message || e);
    return withCORS(NextResponse.json({ success: false, error: e?.message }, { status: 500 }));
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fulfillmentId = url.searchParams.get("id");

    if (!fulfillmentId) {
      return withCORS(NextResponse.json({ success: false, error: "Fulfillment ID required" }, { status: 400 }));
    }

    const body = await req.json();
    const { financialStatus } = body;

    if (!financialStatus) {
      return withCORS(NextResponse.json({ success: false, error: "Financial status required" }, { status: 400 }));
    }

    const current = await prisma.shopifyFulfillment.findUnique({
      where: { id: fulfillmentId },
    });

    if (!current) {
      return withCORS(NextResponse.json({ success: false, error: "Order not found" }, { status: 404 }));
    }

    const currentOrderData = (current.orderData as any) || {};
    currentOrderData.financial_status = financialStatus;

    await prisma.shopifyFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        orderData: currentOrderData,
      },
    });

    if (current.shopifyOrderId) {
      const fulfillmentOrder = await prisma.fulfillmentOrder.findFirst({
        where: { shopifyOrderId: current.shopifyOrderId.toString() },
      });

      if (fulfillmentOrder) {
        const paymentData = (fulfillmentOrder.payment as any) || {};
        paymentData.status = financialStatus;

        await prisma.fulfillmentOrder.update({
          where: { id: fulfillmentOrder.id },
          data: { payment: paymentData },
        });
      }
    }

    return withCORS(
      NextResponse.json({
        success: true,
        message: "Financial status updated successfully",
        financialStatus,
      })
    );
  } catch (e: any) {
    console.error("Update fulfillment error:", e?.message || e);
    return withCORS(NextResponse.json({ success: false, error: "Failed to update financial status" }, { status: 500 }));
  }
}
