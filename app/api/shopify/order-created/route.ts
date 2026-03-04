import { NextRequest, NextResponse } from "next/server";

// In-memory store for received orders (for demo; use DB in production)
let orders: any[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Save the order data (prepend for latest first)
    orders.unshift({ receivedAt: new Date().toISOString(), ...body });
    // Limit to last 20 orders
    if (orders.length > 20) orders = orders.slice(0, 20);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
}

// For demo: allow GET to fetch latest orders (not for production)
export async function GET() {
  return NextResponse.json({ orders });
}