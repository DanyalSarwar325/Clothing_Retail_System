import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rawFulfillments = await prisma.shopifyFulfillment.findMany({
      orderBy: { createdAt: "desc" },
    });

    const fulfillments = rawFulfillments.map((f) => ({
      ...f,
      _id: f.id,
      shopifyOrderId: f.shopifyOrderId.toString(),
    }));

    return NextResponse.json({ success: true, fulfillments });
  } catch (error: any) {
    console.error("Error fetching fulfillment data:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch fulfillments" },
      { status: 500 }
    );
  }
}
