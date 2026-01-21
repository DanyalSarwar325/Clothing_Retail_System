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
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Aggregate scans by design for this department with design-specific rates
    const breakdown = await Barcode.aggregate([
      { $unwind: "$departmentHistory" },
      { $match: { "departmentHistory.department": department } },
      {
        $project: {
          design: 1,
          departmentRates: 1,
          // Find the rate for this specific department
          designRate: {
            $let: {
              vars: {
                matchedRate: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ["$departmentRates", []] },
                        as: "rate",
                        cond: { $eq: ["$$rate.department", department] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] },
            },
          },
        },
      },
      {
        $group: {
          _id: "$design",
          scanCount: { $sum: 1 },
          totalAmount: { $sum: "$designRate" },
          ratePerPiece: { $first: "$designRate" },
        },
      },
      { $sort: { scanCount: -1 } },
    ]);

    const designBreakdown = breakdown.map((item) => ({
      design: item._id,
      scanCount: item.scanCount,
      ratePerPiece: item.ratePerPiece,
      amount: item.totalAmount,
    }));

    const totalScans = designBreakdown.reduce((sum, item) => sum + item.scanCount, 0);
    const totalAmount = designBreakdown.reduce((sum, item) => sum + item.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        department,
        fallbackRate,
        totalScans,
        totalAmount,
        designs: designBreakdown,
        note: "Using design-specific rates when available",
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
