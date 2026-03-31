import { NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyFulfillment from "@/app/libs/models/shopifyFulfillment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await DbConnect();

    const fulfillments = await ShopifyFulfillment.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, fulfillments });
  } catch (error: any) {
    console.error("Error fetching fulfillment data:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch fulfillments" },
      { status: 500 }
    );
  }
}
