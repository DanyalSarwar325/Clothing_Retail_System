import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyOrder from "@/app/libs/models/shopifyOrder";

// Helper to add CORS headers
function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function POST(req: NextRequest) {
  try {
    await DbConnect();
    const body = await req.json();
    // Save the order data to MongoDB
    await ShopifyOrder.create({
      receivedAt: new Date().toISOString(),
      orderData: body,
    });
    return withCORS(NextResponse.json({ success: true }));
  } catch (e) {
    console.error("Shopify order-created POST error:", e);
    return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
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