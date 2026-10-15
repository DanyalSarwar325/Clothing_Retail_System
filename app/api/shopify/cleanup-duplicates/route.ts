import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allOrders = await prisma.shopifyOrder.findMany({
      orderBy: { createdAt: "asc" },
    });

    const seenOrderIds = new Set<string>();
    const duplicateIds: string[] = [];

    for (const order of allOrders) {
      const shopifyId = order.shopifyOrderId.toString();

      if (seenOrderIds.has(shopifyId)) {
        duplicateIds.push(order.id);
      } else {
        seenOrderIds.add(shopifyId);
      }
    }

    if (duplicateIds.length > 0) {
      await prisma.shopifyOrder.deleteMany({
        where: { id: { in: duplicateIds } },
      });
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
