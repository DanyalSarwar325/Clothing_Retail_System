import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Get items that are dispatched or delivered (for payment tracking)
    const items = await FinalSticker.find({
      status: { $in: ["dispatched", "delivered"] }
    })
    .sort({ 
      // Show dispatched (pending payment) first, then by date
      status: 1, 
      "dispatchInfo.dispatchedAt": -1 
    })
    .lean();

    return NextResponse.json({ 
      success: true, 
      items 
    });

  } catch (error: any) {
    console.error("Error fetching revenue items:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch items" },
      { status: 500 }
    );
  }
}
