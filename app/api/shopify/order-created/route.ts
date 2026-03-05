import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyOrder from "@/app/libs/models/shopifyOrder";

// Disable caching for this route
export const dynamic = "force-dynamic";

// Helper to add CORS headers
function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// Verify Shopify HMAC signature
function verifyShopifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("SHOPIFY_WEBHOOK_SECRET not set — skipping HMAC verification");
    return true; // Allow in dev if secret not configured
  }
  if (!hmacHeader) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
}

export async function POST(req: NextRequest) {
  try {
    // Read raw body for HMAC verification
    const rawBody = await req.text();
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

    // Verify webhook authenticity
    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      console.error("Shopify webhook HMAC verification failed");
      return withCORS(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    // Parse body
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("Failed to parse Shopify webhook body");
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    // Extract the Shopify order ID for deduplication
    const shopifyOrderId = body.id;
    if (!shopifyOrderId) {
      console.error("No order ID found in webhook payload");
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    await DbConnect();

    // Upsert: only insert if this order ID doesn't already exist
    const result = await ShopifyOrder.findOneAndUpdate(
      { shopifyOrderId },
      {
        $setOnInsert: {
          shopifyOrderId,
          receivedAt: new Date().toISOString(),
          orderData: body,
        },
      },
      { upsert: true, new: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) {
      console.log(`Shopify order ${shopifyOrderId} already exists — skipped duplicate`);
    } else {
      console.log(`Shopify order ${shopifyOrderId} saved successfully`);
    }

    // Always return 200 quickly so Shopify doesn't retry
    return withCORS(NextResponse.json({ success: true }));
  } catch (e: any) {
    console.error("Shopify order-created POST error:", e?.message || e);
    // Still return 200 to prevent Shopify retries even on internal errors
    return withCORS(NextResponse.json({ success: true }));
  }
}

// Fetch latest orders from MongoDB
export async function GET() {
  try {
    await DbConnect();
    const orders = await ShopifyOrder.find().sort({ createdAt: -1 }).limit(20).lean();
    return withCORS(NextResponse.json({ orders }));
  } catch (e) {
    console.error("Shopify order-created GET error:", e);
    return withCORS(NextResponse.json({ orders: [] }));
  }
}

// Handle preflight OPTIONS request for CORS
export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}