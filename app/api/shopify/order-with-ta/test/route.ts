import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import OrderWithTA from "@/app/libs/models/orderWithTA";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TEST ENDPOINT - Test Shopify webhook without needing Shopify
 * POST /api/shopify/order-with-ta/test
 * 
 * Example usage with curl:
 * curl -X POST http://localhost:3000/api/shopify/order-with-ta/test \
 *   -H "Content-Type: application/json" \
 *   -d '{"order_id":123,"order_number":"#1001","customer_id":456,"fulfillment":{"id":"789","tracking_info":{"number":"TRK123"}}}'
 */

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log("\n================== TEST WEBHOOK ==================");
    console.log("Raw Body:", rawBody);
    
    const body = JSON.parse(rawBody);
    console.log("Parsed Body:", JSON.stringify(body, null, 2));

    // Try to extract fields
    const orderId = body.order_id || body.id || body.shopify_order_id || body.fulfillment?.order_id;
    const orderNumber = body.order_number || body.number || body.name || body.fulfillment?.order_number;
    const customerId = body.customer_id || body.customer?.id || body.shopify_customer_id;

    console.log("Extracted:", { orderId, orderNumber, customerId });

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: "Missing order_id field",
        received: body,
        tips: "Try sending one of these fields: order_id, id, shopify_order_id, fulfillment.order_id"
      }, { status: 400 });
    }

    console.log("Connecting to database...");
    await DbConnect();
    console.log("Database connected!");

    console.log("Saving to OrderWithTA collection...");
    const savedOrder = await OrderWithTA.findOneAndUpdate(
      { orderId: orderId },
      {
        orderId: orderId,
        orderNumber: orderNumber,
        customerId: customerId,
        rawPayload: body,
        processedAt: new Date(),
        status: "received",
        shopifyWebhookId: "test-webhook",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log("✅ Saved successfully:", savedOrder._id);
    console.log("==================================================\n");

    return NextResponse.json({
      success: true,
      message: "Test data saved successfully",
      savedId: savedOrder._id,
      data: {
        orderId: orderId,
        orderNumber: orderNumber,
        customerId: customerId,
      }
    });
  } catch (error: any) {
    console.error("❌ Test Error:", error?.message || error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Test failed",
      stack: error?.stack
    }, { status: 500 });
  }
}

/**
 * GET /api/shopify/order-with-ta/test
 * Check what data you've received so far
 */
export async function GET(req: NextRequest) {
  try {
    await DbConnect();
    const data = await OrderWithTA.find({}).limit(10).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message
    }, { status: 500 });
  }
}
