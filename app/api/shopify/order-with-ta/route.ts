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
 * Stores the raw Shopify webhook payload as-is for later visualization
 */
export async function POST(req: NextRequest) {
  try {
    console.log("=== ORDER WITH TRACKING ADDRESS WEBHOOK RECEIVED ===");
    console.log("Headers:", Object.fromEntries(req.headers.entries()));

    const rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
      console.log("\n=== RAW SHOPIFY WEBHOOK DATA ===");
      console.log(JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("Failed to parse webhook body:", parseError);
      return withCORS(NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }));
    }

    // Extract basic identifiers - try multiple possible field names
    const orderId = body.order_id || body.id || body.shopify_order_id || body.fulfillment?.order_id;
    const orderNumber = body.order_number || body.number || body.name || body.fulfillment?.order_number;
    const customerId = body.customer_id || body.customer?.id || body.shopify_customer_id;
    const fulfillmentId = body.fulfillment_id || body.fulfillment?.id || body.id;
    const webhookId = req.headers.get("x-shopify-webhook-id") || `webhook-${Date.now()}`;

    console.log("Extracted fields:", { orderId, orderNumber, customerId, fulfillmentId });
    
    if (!orderId) {
      console.error("No order ID found in webhook payload");
      return withCORS(NextResponse.json({ success: false, error: "Missing order ID in payload" }, { status: 400 }));
    }

    console.log("Connecting to database...");
    await DbConnect();
    console.log("Database connected successfully");

    // Store raw payload as-is
    console.log("Storing raw order data...");
    const savedOrder = await OrderWithTA.findOneAndUpdate(
      { orderId: orderId },
      {
        shopifyWebhookId: webhookId,
        orderId: orderId,
        orderNumber: orderNumber,
        customerId: customerId,
        rawPayload: body,
        processedAt: new Date(),
        status: "received",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    console.log("Order with TA saved successfully with _id:", savedOrder._id);
    console.log("=== ORDER WITH TRACKING ADDRESS WEBHOOK COMPLETED SUCCESSFULLY ===");

    return withCORS(
      NextResponse.json({
        success: true,
        message: "Raw order data stored successfully",
        orderId: orderId,
        orderNumber: orderNumber,
        dbId: savedOrder._id,
      })
    );
  } catch (e: any) {
    console.error("=== ORDER WITH TRACKING ADDRESS WEBHOOK ERROR ===");
    console.error("Error details:", e?.message || e);
    console.error("Stack trace:", e?.stack);
    return withCORS(
      NextResponse.json(
        { success: false, error: e?.message || "Webhook processing failed" },
        { status: 500 }
      )
    );
  }
}

/**
 * GET - Retrieve all orders with tracking address data
 * Query params:
 * - orderId: filter by specific order ID
 * - limit: number of results (default: 50, max: 100)
 * - skip: pagination offset (default: 0)
 * - sortBy: field to sort by (default: createdAt)
 * - sortOrder: 1 for ascending, -1 for descending (default: -1)
 */
export async function GET(req: NextRequest) {
  try {
    console.log("=== ORDER WITH TA GET REQUEST ===");
    await DbConnect();

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0");
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = parseInt(url.searchParams.get("sortOrder") || "-1");

    // Build filter
    const filter: any = {};
    if (orderId) {
      filter.orderId = orderId;
    }

    // Execute query
    const orders = await OrderWithTA.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await OrderWithTA.countDocuments(filter);

    console.log(`Retrieved ${orders.length} orders with TA (total: ${total})`);

    return withCORS(
      NextResponse.json({
        success: true,
        data: orders,
        pagination: {
          total,
          limit,
          skip,
          hasMore: skip + limit < total,
        },
      })
    );
  } catch (e: any) {
    console.error("=== ORDER WITH TA GET ERROR ===");
    console.error("Error:", e?.message || e);
    return withCORS(
      NextResponse.json(
        { success: false, error: e?.message || "Failed to retrieve orders" },
        { status: 500 }
      )
    );
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}
