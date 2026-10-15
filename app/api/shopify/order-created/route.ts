import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function verifyShopifyHmac(_rawBody: string, _hmacHeader: string | null): boolean {
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

    const shopifyOrderId = body.id;
    if (!shopifyOrderId) {
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    const shopifyOrderIdBigInt = BigInt(shopifyOrderId);

    const existingOrder = await prisma.shopifyOrder.findUnique({
      where: { shopifyOrderId: shopifyOrderIdBigInt },
    });

    if (existingOrder) {
      return withCORS(NextResponse.json({ success: true, message: "duplicate" }));
    }

    const newOrder = await prisma.shopifyOrder.create({
      data: {
        shopifyOrderId: shopifyOrderIdBigInt,
        receivedAt: new Date().toISOString(),
        orderData: body,
      },
    });

    return withCORS(
      NextResponse.json({
        success: true,
        message: "created",
        orderId: newOrder.id,
      })
    );
  } catch (e: any) {
    console.error("Order created webhook error:", e);
    return withCORS(NextResponse.json({ success: true }));
  }
}

export async function GET() {
  try {
    const rawOrders = await prisma.shopifyOrder.findMany({
      orderBy: { createdAt: "desc" },
    });

    const orders = rawOrders.map((o) => {
      const d = (o.orderData as any) || {};
      const customer = d.customer || {};
      const shippingAddr = d.shipping_address || {};
      return {
        _id: o.id,
        id: o.id,
        shopifyOrderId: o.shopifyOrderId.toString(),
        receivedAt: o.receivedAt,
        orderName: d.name || d.order_number || `#${o.shopifyOrderId.toString()}`,
        customerName: shippingAddr.name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "N/A",
        totalPrice: d.total_price || "0.00",
        currency: d.currency || "",
        email: d.email || d.contact_email || customer.email || "N/A",
        phone: shippingAddr.phone || d.phone || customer.phone || "N/A",
        address: formatAddress(shippingAddr),
        financialStatus: d.financial_status || "N/A",
        fulfillmentStatus: d.fulfillment_status || "unfulfilled",
      };
    });

    return withCORS(NextResponse.json({ orders }));
  } catch (e) {
    console.error("Shopify order-created GET error:", e);
    return withCORS(NextResponse.json({ orders: [] }));
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
    const orderId = url.searchParams.get("id");

    if (!orderId) {
      return withCORS(NextResponse.json({ success: false, error: "Order ID required" }, { status: 400 }));
    }

    await prisma.shopifyOrder.delete({
      where: { id: orderId },
    });

    return withCORS(NextResponse.json({ success: true, message: "Order deleted successfully" }));
  } catch (e: any) {
    console.error("Delete order error:", e?.message || e);
    return withCORS(NextResponse.json({ success: false, error: e?.message }, { status: 500 }));
  }
}