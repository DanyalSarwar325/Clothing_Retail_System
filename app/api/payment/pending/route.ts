import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Rate from "@/app/libs/models/rate";

// Departments that have item-based rates
const ITEM_BASED_DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
];

// Departments that use FinalSticker model
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

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

    // Special handling for Packing and Store - uses FinalSticker model
    if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
      const results = await FinalSticker.aggregate([
        {
          $match: {
            "departmentHistory": {
              $elemMatch: {
                department: department,
                scannedBy: userName,
              },
            },
          },
        },
        { $unwind: "$departmentHistory" },
        {
          $match: {
            "departmentHistory.department": department,
            "departmentHistory.scannedBy": userName,
          },
        },
        {
          $addFields: {
            deptRate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "rate",
                          cond: { $eq: ["$$rate.department", department] }
                        }
                      },
                      0
                    ]
                  }
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] }
              }
            },
          },
        },
        {
          $group: {
            _id: null,
            scanCount: { $sum: 1 },
            totalPayment: { $sum: "$deptRate" },
            pendingPayment: { $sum: "$deptRate" },
            ratePerUnit: { $first: "$deptRate" },
          },
        },
      ]);

      const scanCount = results[0]?.scanCount || 0;
      const pendingPayment = results[0]?.pendingPayment || 0;
      const totalPayment = results[0]?.totalPayment || 0;
      const ratePerUnit = results[0]?.ratePerUnit || fallbackRate;

      return NextResponse.json({
        success: true,
        data: {
          userName,
          department,
          scanCount,
          paidCount: 0,
          pendingCount: scanCount,
          ratePerUnit,
          pendingPayment,
          totalPayment,
          note: `${department} payment calculated from final sticker scans`,
        },
      });
    }

    // Check if this department uses item-based rates
    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    // Count all scans by the user in their department
    let matchCondition: any = {
      "departmentHistory": {
        $elemMatch: {
          department: department,
          scannedBy: userName,
        },
      },
    };

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
        $addFields: {
          // Check if this piece is already paid for this department
          isPaid: {
            $cond: [
              { $isArray: "$paidDepartments" },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$paidDepartments",
                        as: "pd",
                        cond: { $eq: ["$$pd.department", department] },
                      },
                    },
                  },
                  0,
                ],
              },
              false,
            ],
          },
          // Find the rate for this specific department and item
          // Use $reduce to properly access document's $item field
          designRate: usesItemBasedRates
            ? {
                $reduce: {
                  input: { $ifNull: ["$departmentRates", []] },
                  initialValue: fallbackRate,
                  in: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$$this.department", department] },
                          { $eq: ["$$this.item", "$item"] },
                        ],
                      },
                      "$$this.ratePerPiece",
                      "$$value",
                    ],
                  },
                },
              }
            : {
                $reduce: {
                  input: { $ifNull: ["$departmentRates", []] },
                  initialValue: fallbackRate,
                  in: {
                    $cond: [
                      { $eq: ["$$this.department", department] },
                      "$$this.ratePerPiece",
                      "$$value",
                    ],
                  },
                },
              },
        },
      },
      {
        $group: {
          _id: null,
          totalPayment: { $sum: "$designRate" },
          // Only count unpaid pieces for pending payment
          pendingPayment: {
            $sum: {
              $cond: [{ $eq: ["$isPaid", false] }, "$designRate", 0],
            },
          },
          scanCount: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] },
          },
        },
      },
    ]);

    const scanCount = results[0]?.scanCount || 0;
    const paidCount = results[0]?.paidCount || 0;
    const pendingPayment = results[0]?.pendingPayment || 0;
    const totalPayment = results[0]?.totalPayment || 0;

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        scanCount,
        paidCount,
        pendingCount: scanCount - paidCount,
        ratePerUnit: fallbackRate, // For display purposes
        pendingPayment,
        totalPayment,
        note: usesItemBasedRates 
          ? "Payment calculated using item-specific rates (Qameez/Shalwar/Dupatta)"
          : "Payment calculated using design-specific rates when available",
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
