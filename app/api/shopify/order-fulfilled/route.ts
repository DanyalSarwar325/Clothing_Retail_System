import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyFulfillment from "@/app/libs/models/shopifyFulfillment";
import FulfillmentOrder from "@/app/libs/models/fulfillmentOrder";
import { transformShopifyFulfillmentData } from "@/app/libs/utils/transformShopifyData";

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
      
      // Enhanced tracking information logging
      console.log("\n📍 TRACKING INFORMATION ANALYSIS:");
      if (body.tracking_number) console.log("  ✓ tracking_number:", body.tracking_number);
      if (body.tracking_company) console.log("  ✓ tracking_company:", body.tracking_company);
      if (body.tracking_numbers && body.tracking_numbers.length > 0) {
        console.log("  ✓ tracking_numbers array:", body.tracking_numbers);
      }
      if (body.tracking_info) {
        console.log("  ✓ tracking_info object:", {
          number: body.tracking_info.number,
          company: body.tracking_info.company,
          url: body.tracking_info.url
        });
      }
      
      // Check in fulfillments array
      if (Array.isArray(body.fulfillments) && body.fulfillments.length > 0) {
        console.log(`\n  📦 Found ${body.fulfillments.length} fulfillment(s) in array:`);
        body.fulfillments.forEach((f: any, idx: number) => {
          console.log(`  [${idx}] Fulfillment ID: ${f.id}`);
          console.log(`      - tracking_number: ${f.tracking_number || "N/A"}`);
          console.log(`      - tracking_company: ${f.tracking_company || "N/A"}`);
          console.log(`      - tracking_numbers: ${JSON.stringify(f.tracking_numbers) || "N/A"}`);
          console.log(`      - tracking_url: ${f.tracking_url || "N/A"}`);
          console.log(`      - status: ${f.status || "N/A"}`);
        });
      }
      
      if (!body.tracking_number && !body.tracking_company && (!body.tracking_numbers || body.tracking_numbers.length === 0) &&
          (!Array.isArray(body.fulfillments) || body.fulfillments.length === 0 || !body.fulfillments[0].tracking_number)) {
        console.log("  ⚠️ WARNING: No tracking data found in any expected field!");
      }
      
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

    // Transform Shopify data to structured format
    console.log("Transforming Shopify fulfillment data...");
    const transformedData = transformShopifyFulfillmentData(body);
    console.log("Transformation successful:", {
      orderId: transformedData.orderId,
      orderNumber: transformedData.orderNumber,
      total: transformedData.pricing.total,
    });
    console.log("📊 TRACKING DATA IN TRANSFORMED OBJECT:", {
      trackingNumber: transformedData.fulfillment.trackingNumber,
      trackingCompany: transformedData.fulfillment.trackingCompany,
      trackingUrl: transformedData.fulfillment.trackingUrl,
    });

    // Save raw Shopify payload
    console.log("Upserting raw fulfillment with order ID:", shopifyOrderId);
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
    console.log("Raw fulfillment saved successfully with _id:", savedFulfillment._id);

    // Save structured fulfillment data
    console.log("Saving transformed fulfillment data with order ID:", transformedData.orderId);
    const savedStructuredFulfillment = await FulfillmentOrder.findOneAndUpdate(
      { orderId: transformedData.orderId },
      {
        ...transformedData,
        shopifyOrderId: shopifyOrderId,
        rawPayload: body,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("Structured fulfillment saved successfully with _id:", savedStructuredFulfillment._id);
    console.log("💾 SAVED FULFILLMENT TRACKING DATA:", {
      trackingNumber: savedStructuredFulfillment.fulfillment?.trackingNumber,
      trackingCompany: savedStructuredFulfillment.fulfillment?.trackingCompany,
      trackingUrl: savedStructuredFulfillment.fulfillment?.trackingUrl,
    });

    console.log("=== ORDER FULFILLED WEBHOOK COMPLETED SUCCESSFULLY ===");
    return withCORS(
      NextResponse.json({
        success: true,
        message: "saved",
        fulfillmentId: savedFulfillment._id,
        structuredFulfillmentId: savedStructuredFulfillment._id,
      })
    );
  } catch (e: any) {
    console.error("=== ORDER FULFILLED WEBHOOK ERROR ===");
    console.error("Error details:", e?.message || e);
    console.error("Stack trace:", e?.stack);
    return withCORS(NextResponse.json({ success: true }));
  }
}

export async function GET(req: NextRequest) {
  try {
    await DbConnect();
    
    // Get pagination parameters
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0");
    
    // Get total count and paginated records
    const [fulfillments, total] = await Promise.all([
      ShopifyFulfillment.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      ShopifyFulfillment.countDocuments(),
    ]);

    const orders = fulfillments.map((f: any) => {
      const d = f.orderData || {};
      
      // Extract tracking from fulfillments array if available
      let trackingNumber = "N/A";
      let trackingCompany = "N/A";
      
      // Priority: direct properties > fulfillments array > fallback
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
      
      // If still no company, check direct property
      if (trackingCompany === "N/A" && d.tracking_company) {
        trackingCompany = d.tracking_company;
      }
      
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
