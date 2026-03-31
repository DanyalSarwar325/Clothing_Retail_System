import { NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import ShopifyFulfillment from "@/app/libs/models/shopifyFulfillment";

export async function GET() {
  try {
    console.log("Fetching fulfillment data from the database...");

    // Connect to the database
    await DbConnect();

    // Fetch all fulfillment data
    const fulfillments = await ShopifyFulfillment.find().sort({ createdAt: -1 }).lean();

    console.log("Fulfillment data fetched successfully.");

    return NextResponse.json({ success: true, fulfillments });
  } catch (error) {
    console.error("Error fetching fulfillment data:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}