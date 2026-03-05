import { NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyOrder from "@/app/libs/models/shopifyOrder";

export const dynamic = "force-dynamic";

/**
 * One-time cleanup: deduplicate existing orders by keeping only the first
 * record for each unique Shopify order ID (orderData.id).
 * 
 * Run once via: GET /api/shopify/cleanup-duplicates
 * Delete this file after running.
 */
export async function GET() {
  try {
    await DbConnect();

    const allOrders = await ShopifyOrder.find().sort({ createdAt: 1 }).lean();

    const seenOrderIds = new Set<number>();
    const duplicateIds: any[] = [];

    for (const order of allOrders) {
      const shopifyId = order.shopifyOrderId || order.orderData?.id;
      if (!shopifyId) continue;

      if (seenOrderIds.has(shopifyId)) {
        duplicateIds.push(order._id);
      } else {
        seenOrderIds.add(shopifyId);
        // Backfill shopifyOrderId if missing on the kept record
        if (!order.shopifyOrderId && order.orderData?.id) {
          await ShopifyOrder.updateOne(
            { _id: order._id },
            { $set: { shopifyOrderId: order.orderData.id } }
          );
        }
      }
    }

    if (duplicateIds.length > 0) {
      await ShopifyOrder.deleteMany({ _id: { $in: duplicateIds } });
    }

    return NextResponse.json({
      success: true,
      totalBefore: allOrders.length,
      duplicatesRemoved: duplicateIds.length,
      uniqueOrders: seenOrderIds.size,
    });
  } catch (e: any) {
    console.error("Cleanup error:", e?.message || e);
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
