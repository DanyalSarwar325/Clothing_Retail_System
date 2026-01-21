import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

// GET - Pending payment per design for a user in a department
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const userName = searchParams.get("userName");
    const department = searchParams.get("department");

    if (!userName || !department) {
      return NextResponse.json(
        { success: false, message: "userName and department are required" },
        { status: 400 }
      );
    }

    // Get fallback global rate for department
    const globalRate = await Rate.findOne({ department });
    const fallbackRate = globalRate?.ratePerUnit || 0;

    // Aggregate scans per design for this user & department
    // For Cutting department: only count 'scanned' barcodes (confirmed by sewing)
    // For other departments: count all scans
    const matchStage: any = {};

    if (department === "Cutting") {
      matchStage.status = "scanned";
    }

    const results = await Barcode.aggregate([
      { $match: matchStage },
      { $unwind: "$departmentHistory" },
      {
        $match: {
          "departmentHistory.department": department,
          "departmentHistory.scannedBy": userName,
        },
      },
      {
        $project: {
          design: 1,
          departmentRates: 1,
          // Find the rate for this specific department from design rates
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
          totalPayment: { $sum: "$designRate" },
          ratePerPiece: { $first: "$designRate" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const perDesign = results.map((row) => ({
      design: row._id as string,
      scanCount: row.scanCount as number,
      ratePerUnit: row.ratePerPiece as number,
      pendingPayment: row.totalPayment as number,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        fallbackRate,
        perDesign,
        note: "Using design-specific rates when available",
      },
    });
  } catch (error: any) {
    console.error("Error calculating payment by design:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to calculate payment" },
      { status: 500 }
    );
  }
}
