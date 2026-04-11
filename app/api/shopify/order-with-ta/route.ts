import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import OrderWithTA from "@/app/libs/models/orderWithTA";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

/**
 * POST - Receive order with tracking address (TA) webhook
 * Stores the Shopify webhook payload with tracking address info
 */
export async function POST(req: NextRequest) {
  try {
    console.log("=== ORDER WITH TRACKING ADDRESS WEBHOOK RECEIVED ===");
    console.log("Headers:", Object.fromEntries(req.headers.entries()));
    console.log("URL:", req.url);
    console.log("Method:", req.method);

    const rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);
    console.log("Raw body (first 500 chars):", rawBody.substring(0, 500));
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
      console.log("Parsed body keys:", Object.keys(body));
      console.log("Body.id:", body.id);
      console.log("Body sample:", JSON.stringify(body, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error("Failed to parse webhook body:", parseError);
      console.error("Raw body that failed to parse:", rawBody);
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    // Extract the Shopify order ID (matches order-created logic)
    const orderId = body.id;
    const webhookId = req.headers.get("x-shopify-webhook-id") || `webhook-${Date.now()}`;

    console.log("Extracted orderId:", orderId);
    
    if (!orderId) {
      console.error("No order ID found in webhook payload");
      console.error("Available keys in body:", Object.keys(body));
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    console.log("Connecting to database...");
    await DbConnect();
    console.log("Database connected successfully");

    // Check if order already exists (prevent duplicates)
    console.log("Checking if order exists with ID:", orderId);
    const existingOrder = await OrderWithTA.findOne({ orderId });
    
    if (existingOrder) {
      console.log(`Order ${orderId} already exists — skipped duplicate`);
      console.log("=== ORDER WITH TRACKING ADDRESS WEBHOOK COMPLETED (DUPLICATE SKIPPED) ===");
      return withCORS(NextResponse.json({ success: true, message: "duplicate" }));
    }

    // Create new order with transformed data
    console.log("Creating new order with ID:", orderId);
    const newOrder = await OrderWithTA.create({
      shopifyWebhookId: webhookId,
      orderId: orderId,
      orderNumber: body.name || body.order_number || `#${orderId}`,
      customerId: body.customer?.id,
      rawPayload: body,
      receivedAt: new Date().toISOString(),
      processedAt: new Date(),
      status: "received",
    });
    
    console.log("Order with TA saved successfully with _id:", newOrder._id);
    console.log("=== ORDER WITH TRACKING ADDRESS WEBHOOK COMPLETED SUCCESSFULLY ===");

    return withCORS(
      NextResponse.json({
        success: true,
        message: "created",
        orderId: orderId,
        orderNumber: newOrder.orderNumber,
        dbId: newOrder._id,
      })
    );
  } catch (e: any) {
    console.error("=== ORDER WITH TRACKING ADDRESS WEBHOOK ERROR ===");
    console.error("Error details:", e?.message || e);
    console.error("Stack trace:", e?.stack);
    return withCORS(
      NextResponse.json(
        { success: true },
        { status: 200 }
      )
    );
  }
}

/**
 * GET - Retrieve all orders with tracking address data
 * Returns formatted data similar to order-created route for consistency
 */
export async function GET() {
  try {
    console.log("=== ORDER WITH TA GET REQUEST ===");
    await DbConnect();

    const rawOrders = await OrderWithTA.find().sort({ createdAt: -1 }).lean();

    const orders = rawOrders.map((o: any) => {
      const d = o.rawPayload || {};
      const customer = d.customer || {};
      const shippingAddr = d.shipping_address || {};
      return {
        _id: o._id,
        shopifyOrderId: o.orderId,
        receivedAt: o.receivedAt,
        orderName: d.name || d.order_number || `#${o.orderId}`,
        customerName: shippingAddr.name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "N/A",
        totalPrice: d.total_price || "0.00",
        currency: d.currency || "",
        email: d.email || d.contact_email || customer.email || "N/A",
        phone: shippingAddr.phone || d.phone || customer.phone || "N/A",
        address: formatAddress(shippingAddr),
        financialStatus: d.financial_status || "N/A",
        fulfillmentStatus: d.fulfillment_status || "unfulfilled",
        orderData: d,
      };
    });

    console.log(`Retrieved ${orders.length} orders with TA`);

    return withCORS(NextResponse.json({ orders }));
  } catch (e: any) {
    console.error("Order with TA GET error:", e);
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
