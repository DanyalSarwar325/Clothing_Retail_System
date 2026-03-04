import { NextRequest, NextResponse } from "next/server";

// In-memory store for received orders (for demo; use DB in production)
let orders: any[] = [];

// Helper to add CORS headers
function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Save the order data (prepend for latest first)
    orders.unshift({ receivedAt: new Date().toISOString(), ...body });
    // Limit to last 20 orders
    if (orders.length > 20) orders = orders.slice(0, 20);
    return withCORS(NextResponse.json({ success: true }));
  } catch (e) {
    return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
  }
}

// For demo: allow GET to fetch latest orders (not for production)
export async function GET() {
  return withCORS(NextResponse.json({ orders }));
}

// Handle preflight OPTIONS request for CORS
export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}