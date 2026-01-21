import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

// GET - Calculate pending payment for a user in a department
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

    // For Cutting department: count only 'scanned' barcodes (confirmed by sewing)
    // For other departments: count all scans by the user in their department
    let matchCondition: any = {
      "departmentHistory": {
        $elemMatch: {
          department: department,
          scannedBy: userName,
        },
      },
    };

    if (department === "Cutting") {
      matchCondition.status = "scanned";
    }

    // Aggregate to calculate payment using design-specific rates
    const results = await Barcode.aggregate([
      { $match: matchCondition },
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
          _id: null,
          totalPayment: { $sum: "$designRate" },
          scanCount: { $sum: 1 },
        },
      },
    ]);

    const scanCount = results[0]?.scanCount || 0;
    const pendingPayment = results[0]?.totalPayment || 0;

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        scanCount,
        ratePerUnit: fallbackRate, // For display purposes
        pendingPayment,
        note: "Payment calculated using design-specific rates when available",
      },
    });
  } catch (error: any) {
    console.error("Error calculating payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to calculate payment" },
      { status: 500 }
    );
  }
}
