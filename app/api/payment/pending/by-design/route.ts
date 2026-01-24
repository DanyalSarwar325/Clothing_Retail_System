import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Rate from "@/app/libs/models/rate";

// Departments that have item-based rates (Qameez, Shalwar, Dupatta)
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Press"];

// Departments that use FinalSticker model
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

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

    // Special handling for Packing and Store - uses FinalSticker model
    if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
      const results = await FinalSticker.aggregate([
        {
          $match: {
            departmentHistory: {
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
            _id: "$design",
            scanCount: { $sum: 1 },
            pendingPayment: { $sum: "$deptRate" },
            totalPayment: { $sum: "$deptRate" },
            ratePerUnit: { $first: "$deptRate" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const perDesign = results.map((row) => ({
        design: row._id as string,
        scanCount: row.scanCount as number,
        pendingCount: row.scanCount as number,
        paidCount: 0,
        ratePerUnit: row.ratePerUnit as number,
        pendingPayment: row.pendingPayment as number,
        totalPayment: row.totalPayment as number,
      }));

      // If all rates are the same, show a single rate, else null
      const uniqueRates = [...new Set(results.map((r) => r.ratePerUnit))];
      const ratePerUnit = uniqueRates.length === 1 ? uniqueRates[0] : null;

      return NextResponse.json({
        success: true,
        data: {
          userName,
          department,
          ratePerUnit,
          perDesign,
          note: `${department} payment calculated from final sticker scans with correct rate and scan count`,
        },
      });
    }

    // Check if this department uses item-based rates
    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    // Aggregate scans per design for this user & department
    // Count all scans for the department
    const matchStage: any = {};

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
          // Find the rate for this specific department from design rates
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
          _id: "$design",
          scanCount: { $sum: 1 },
          totalPayment: { $sum: "$designRate" },
          // Only count unpaid pieces for pending payment
          pendingPayment: {
            $sum: {
              $cond: [{ $eq: ["$isPaid", false] }, "$designRate", 0],
            },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", false] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] },
          },
          // For item-based departments, we can't use $first as rates vary
          ratePerPiece: { $first: "$designRate" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const perDesign = results.map((row) => ({
      design: row._id as string,
      scanCount: row.scanCount as number,
      pendingCount: row.pendingCount as number,
      paidCount: row.paidCount as number,
      ratePerUnit: usesItemBasedRates ? null : (row.ratePerPiece as number), // null for item-based as rates vary
      pendingPayment: row.pendingPayment as number,
      totalPayment: row.totalPayment as number,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        ratePerUnit: fallbackRate,
        perDesign,
        note: usesItemBasedRates 
          ? "Payment calculated using item-specific rates (Qameez/Shalwar/Dupatta)"
          : "Using design-specific rates when available",
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
