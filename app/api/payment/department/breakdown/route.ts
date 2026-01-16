import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "Department is required" },
        { status: 400 }
      );
    }

    const rateDoc = await Rate.findOne({ department });
    const ratePerUnit = rateDoc?.ratePerUnit || 0;

    // Aggregate scans by design for this department
    const breakdown = await Barcode.aggregate([
      { $unwind: "$departmentHistory" },
      { $match: { "departmentHistory.department": department } },
      {
        $group: {
          _id: "$design",
          scanCount: { $sum: 1 },
        },
      },
      { $sort: { scanCount: -1 } },
    ]);

    const designBreakdown = breakdown.map((item) => ({
      design: item._id,
      scanCount: item.scanCount,
      amount: item.scanCount * ratePerUnit,
    }));

    const totalScans = designBreakdown.reduce((sum, item) => sum + item.scanCount, 0);
    const totalAmount = totalScans * ratePerUnit;

    return NextResponse.json({
      success: true,
      data: {
        department,
        ratePerUnit,
        totalScans,
        totalAmount,
        designs: designBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Error fetching department breakdown:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch breakdown" },
      { status: 500 }
    );
  }
}
