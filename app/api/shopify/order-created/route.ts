import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyOrder from "@/app/libs/models/shopifyOrder";

// Disable caching for this route
export const dynamic = "force-dynamic";
// Specify runtime for Vercel
export const runtime = "nodejs";
// Increase timeout for database operations
export const maxDuration = 30;

// Helper to add CORS headers
function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// Verify Shopify HMAC signature (disabled for testing)
function verifyShopifyHmac(_rawBody: string, _hmacHeader: string | null): boolean {
  return true;
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== ORDER CREATED WEBHOOK RECEIVED ===");
    console.log("Headers:", Object.fromEntries(req.headers.entries()));
    console.log("URL:", req.url);
    console.log("Method:", req.method);

    // Read raw body for HMAC verification
    const rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);
    console.log("Raw body (first 500 chars):", rawBody.substring(0, 500));
    
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    console.log("HMAC header:", hmacHeader);

    // Verify webhook authenticity
    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      console.error("Shopify webhook HMAC verification failed");
      return withCORS(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    // Parse body
    let body: any;
    try {
      body = JSON.parse(rawBody);
      console.log("Parsed body keys:", Object.keys(body));
      console.log("Body.id:", body.id);
      console.log("Body sample:", JSON.stringify(body, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.error("Failed to parse Shopify webhook body:", parseError);
      console.error("Raw body that failed to parse:", rawBody);
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    // Extract the Shopify order ID for deduplication
    const shopifyOrderId = body.id;
    console.log("Extracted shopifyOrderId:", shopifyOrderId);
    if (!shopifyOrderId) {
      console.error("No order ID found in webhook payload");
      console.error("Available keys in body:", Object.keys(body));
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    console.log("Connecting to database...");
    await DbConnect();
    console.log("Database connected successfully");

    // Check if order already exists
    console.log("Checking if order exists with ID:", shopifyOrderId);
    const existingOrder = await ShopifyOrder.findOne({ shopifyOrderId });
    
    if (existingOrder) {
      console.log(`Shopify order ${shopifyOrderId} already exists — skipped duplicate`);
      console.log("=== ORDER CREATED WEBHOOK COMPLETED (DUPLICATE SKIPPED) ===");
      return withCORS(NextResponse.json({ success: true, message: "duplicate" }));
    }

    // Create new order
    console.log("Creating new order with ID:", shopifyOrderId);
    const newOrder = await ShopifyOrder.create({
      shopifyOrderId,
      receivedAt: new Date().toISOString(),
      orderData: body,
    });

    console.log("Order created successfully with _id:", newOrder._id);
    console.log("=== ORDER CREATED WEBHOOK COMPLETED SUCCESSFULLY ===");
    return withCORS(NextResponse.json({ success: true, message: "created", orderId: newOrder._id }));
  } catch (e: any) {
    console.error("=== ORDER CREATED WEBHOOK ERROR ===");
    console.error("Error details:", e?.message || e);
    console.error("Stack trace:", e?.stack);
    // Still return 200 to prevent Shopify retries even on internal errors
    return withCORS(NextResponse.json({ success: true }));
  }
}

// Fetch latest orders from MongoDB
export async function GET() {
  try {
    await DbConnect();
    const rawOrders = await ShopifyOrder.find().sort({ createdAt: -1 }).lean();

    const orders = rawOrders.map((o: any) => {
      const d = o.orderData || {};
      const customer = d.customer || {};
      const shippingAddr = d.shipping_address || {};
      return {
        _id: o._id,
        shopifyOrderId: o.shopifyOrderId,
        receivedAt: o.receivedAt,
        orderName: d.name || d.order_number || `#${o.shopifyOrderId}`,
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

// Handle preflight OPTIONS request for CORS
export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}