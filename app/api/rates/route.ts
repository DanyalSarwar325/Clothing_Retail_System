import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Rate from "@/app/libs/models/rate";

// GET - Fetch all rates
export async function GET() {
  try {
    await DbConnect();
    const rates = await Rate.find().sort({ department: 1 });
    
    return NextResponse.json({ success: true, rates });
  } catch (error: any) {
    console.error("Error fetching rates:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch rates" },
      { status: 500 }
    );
  }
}

// POST - Create or update a rate
export async function POST(request: NextRequest) {
  try {
    await DbConnect();
    const { department, ratePerUnit } = await request.json();

    if (!department || ratePerUnit === undefined) {
      return NextResponse.json(
        { success: false, message: "Department and rate per unit are required" },
        { status: 400 }
      );
    }

    if (ratePerUnit < 0) {
      return NextResponse.json(
        { success: false, message: "Rate per unit must be a positive number" },
        { status: 400 }
      );
    }

    // Update or create rate
    const rate = await Rate.findOneAndUpdate(
      { department },
      { ratePerUnit },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Rate updated successfully",
      rate,
    });
  } catch (error: any) {
    console.error("Error updating rate:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update rate" },
      { status: 500 }
    );
  }
}
