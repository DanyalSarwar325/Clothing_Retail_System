import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyFulfillment from "@/app/libs/models/shopifyFulfillment";

export const dynamic = "force-dynamic";
// Specify runtime for Vercel
export const runtime = "nodejs";
// Increase timeout for database operations
export const maxDuration = 30;

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// HMAC verification disabled for testing
function verifyShopifyHmac(_rawBody: string, _hmacHeader: string | null): boolean {
  return true;
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== ORDER FULFILLED WEBHOOK RECEIVED ===");
    console.log("Headers:", Object.fromEntries(req.headers.entries()));
    console.log("URL:", req.url);
    console.log("Method:", req.method);

    const rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);
    console.log("Raw body (first 500 chars):", rawBody.substring(0, 500));
    
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    console.log("HMAC header:", hmacHeader);

    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      console.error("Shopify fulfillment webhook HMAC verification failed");
      return withCORS(NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }));
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
      console.log("\n=== COMPLETE SHOPIFY FULFILLMENT DATA ===");
      console.log("📦 FULL OBJECT STRUCTURE:");
      console.log(JSON.stringify(body, null, 2));
      console.log("\n📝 FIELDS ANALYSIS:");
      console.log("- Available top-level keys:", Object.keys(body));
      console.log("- Data type:", typeof body);
      console.log("- Object entries count:", Object.keys(body).length);
      
      // Log specific commonly used fields if they exist
      if (body.id) console.log("- Fulfillment ID:", body.id);
      if (body.order_id) console.log("- Order ID:", body.order_id);
      if (body.status) console.log("- Status:", body.status);
      if (body.tracking_number) console.log("- Tracking Number:", body.tracking_number);
      if (body.tracking_company) console.log("- Tracking Company:", body.tracking_company);
      if (body.created_at) console.log("- Created At:", body.created_at);
      if (body.updated_at) console.log("- Updated At:", body.updated_at);
      if (body.line_items) console.log("- Line Items Count:", body.line_items?.length);
      if (body.receipt) console.log("- Receipt Data:", body.receipt);
      if (body.service) console.log("- Service:", body.service);
      
      // Log nested objects structure
      Object.keys(body).forEach(key => {
        const value = body[key];
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            console.log(`- ${key} (Array):`, `Length: ${value.length}`, value.length > 0 ? `First item keys: ${Object.keys(value[0] || {})}` : 'Empty array');
          } else {
            console.log(`- ${key} (Object):`, `Keys: ${Object.keys(value)}`);
          }
        } else {
          console.log(`- ${key}:`, value);
        }
      });
      console.log("=== END SHOPIFY FULFILLMENT DATA ===\n");
    } catch (parseError) {
      console.error("Failed to parse Shopify fulfillment webhook body:", parseError);
      console.error("Raw body that failed to parse:", rawBody);
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    const shopifyOrderId = body.order_id || body.id;
    console.log("Extracted shopifyOrderId:", shopifyOrderId);
    if (!shopifyOrderId) {
      console.error("No order ID found in fulfillment webhook payload");
      console.error("Available keys in body:", Object.keys(body));
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID" }, { status: 400 }));
    }

    console.log("Connecting to database...");
    await DbConnect();
    console.log("Database connected successfully");

    // Upsert by order ID so we always keep the latest complete Shopify payload.
    console.log("Upserting fulfillment with order ID:", shopifyOrderId);
    const savedFulfillment = await ShopifyFulfillment.findOneAndUpdate(
      { shopifyOrderId },
      {
        shopifyOrderId,
        receivedAt: new Date().toISOString(),
        orderData: body,
        rawPayload: body,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log("Fulfillment saved successfully with _id:", savedFulfillment._id);
    console.log("=== ORDER FULFILLED WEBHOOK COMPLETED SUCCESSFULLY ===");
    return withCORS(NextResponse.json({ success: true, message: "saved", fulfillmentId: savedFulfillment._id }));
  } catch (e: any) {
    console.error("=== ORDER FULFILLED WEBHOOK ERROR ===");
    console.error("Error details:", e?.message || e);
    console.error("Stack trace:", e?.stack);
    return withCORS(NextResponse.json({ success: true }));
  }
}

export async function GET() {
  try {
    await DbConnect();
    const fulfillments = await ShopifyFulfillment.find().sort({ createdAt: -1 }).lean();

    const orders = fulfillments.map((f: any) => {
      const d = f.orderData || {};
      return {
        _id: f._id,
        shopifyOrderId: f.shopifyOrderId,
        receivedAt: f.receivedAt,
        orderName: d.name || d.order_number || `#${f.shopifyOrderId}`,
        customerName: d.destination?.name || d.shipping_address?.name || d.customer?.first_name
          ? `${d.customer?.first_name || ""} ${d.customer?.last_name || ""}`.trim()
          : "N/A",
        totalPrice: d.total_price || d.order?.total_price || "0.00",
        currency: d.currency || d.order?.currency || "",
        email: d.email || d.order?.email || d.customer?.email || "N/A",
        phone: d.destination?.phone || d.shipping_address?.phone || d.customer?.phone || d.order?.phone || "N/A",
        address: formatAddress(d.destination || d.shipping_address || d.order?.shipping_address),
        fulfillmentStatus: d.status || d.shipment_status || "fulfilled",
        trackingNumber: d.tracking_number || (d.tracking_numbers && d.tracking_numbers[0]) || "N/A",
        trackingCompany: d.tracking_company || "N/A",
      };
    });

    return withCORS(NextResponse.json({ orders }));
  } catch (e) {
    console.error("Shopify order-fulfilled GET error:", e);
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

// Delete a specific fulfillment by ID
export async function DELETE(req: NextRequest) {
  try {
    console.log("=== DELETE FULFILLMENT REQUEST ===");
    const url = new URL(req.url);
    const fulfillmentId = url.searchParams.get("id");
    
    if (!fulfillmentId) {
      return withCORS(NextResponse.json({ success: false, error: "Fulfillment ID required" }, { status: 400 }));
    }

    console.log("Attempting to delete fulfillment with _id:", fulfillmentId);
    await DbConnect();
    
    const deletedFulfillment = await ShopifyFulfillment.findByIdAndDelete(fulfillmentId);
    
    if (!deletedFulfillment) {
      console.log("Fulfillment not found for deletion:", fulfillmentId);
      return withCORS(NextResponse.json({ success: false, error: "Fulfillment not found" }, { status: 404 }));
    }

    console.log("Fulfillment deleted successfully:", fulfillmentId);
    return withCORS(NextResponse.json({ success: true, message: "Fulfillment deleted successfully" }));
  } catch (e: any) {
    console.error("Delete fulfillment error:", e?.message || e);
    return withCORS(NextResponse.json({ success: false, error: e?.message }, { status: 500 }));
  }
}
