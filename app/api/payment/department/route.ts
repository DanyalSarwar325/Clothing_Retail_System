import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Rate from "@/app/libs/models/rate";
import Payment from "@/app/libs/models/payment";

const DEPARTMENTS = [
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

// Departments that have item-based rates (Qameez, Shalwar, Dupatta)
const ITEM_BASED_DEPARTMENTS = ["Sewing", "Press"];

// Departments that use FinalSticker model
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

async function calculateForDepartment(department: string) {
  const rateDoc = await Rate.findOne({ department });
  const fallbackRate = rateDoc?.ratePerUnit || 0;
  
  // Special handling for Packing and Store - uses FinalSticker model
  if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
    // First get all final stickers scanned in this department
    const scansAgg = await FinalSticker.aggregate([
      {
        $match: {
          "departmentHistory.department": department,
        },
      },
      { $unwind: "$departmentHistory" },
      { $match: { "departmentHistory.department": department } },
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
          // Get rate for this department from departmentRates array
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
          totalScans: { $sum: 1 },
          totalDue: { $sum: "$deptRate" },
          // Calculate paid amount (sum of rates for paid pieces)
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$isPaid", true] }, "$deptRate", 0],
            },
          },
          // Calculate pending amount (sum of rates for unpaid pieces)
          pending: {
            $sum: {
              $cond: [{ $eq: ["$isPaid", false] }, "$deptRate", 0],
            },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", false] }, 1, 0] },
          },
          ratePerUnit: { $first: "$deptRate" },
        },
      },
    ]);

    return {
      department,
      ratePerUnit: scansAgg?.[0]?.ratePerUnit || fallbackRate,
      totalScans: scansAgg?.[0]?.totalScans || 0,
      totalPaid: scansAgg?.[0]?.totalPaid || 0,
      totalDue: scansAgg?.[0]?.totalDue || 0,
      pending: scansAgg?.[0]?.pending || 0,
    };
  }

  const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

  // Count all scans for the department and calculate paid/pending based on paidDepartments
  const matchStage: any = {};

  // Aggregate with design-specific rates and payment status
  const scansAgg = await Barcode.aggregate([
    { $match: matchStage },
    { $unwind: "$departmentHistory" },
    { $match: { "departmentHistory.department": department } },
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
        // Find the rate for this specific department (and item for item-based depts)
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
        totalScans: { $sum: 1 },
        totalDue: { $sum: "$designRate" },
        // Calculate paid amount (sum of rates for paid pieces)
        totalPaid: {
          $sum: {
            $cond: [{ $eq: ["$isPaid", true] }, "$designRate", 0],
          },
        },
        // Calculate pending amount (sum of rates for unpaid pieces)
        pending: {
          $sum: {
            $cond: [{ $eq: ["$isPaid", false] }, "$designRate", 0],
          },
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] },
        },
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$isPaid", false] }, 1, 0] },
        },
      },
    },
  ]);

  const totalScans = scansAgg?.[0]?.totalScans || 0;
  const totalDue = scansAgg?.[0]?.totalDue || 0;
  const totalPaid = scansAgg?.[0]?.totalPaid || 0;
  const pending = scansAgg?.[0]?.pending || 0;

  return {
    department,
    ratePerUnit: fallbackRate,
    totalScans,
    totalPaid,
    totalDue,
    pending,
  };
}

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const department = request.nextUrl.searchParams.get("department");

    if (department) {
      const data = await calculateForDepartment(department);
      return NextResponse.json({ success: true, data });
    }

    const results = await Promise.all(DEPARTMENTS.map((dept) => calculateForDepartment(dept)));
    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error fetching department payments:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch department payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const { department, amount, note, createdBy } = await request.json();

    if (!department || amount === undefined) {
      return NextResponse.json(
        { success: false, message: "Department and amount are required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const payment = await Payment.create({ department, amount, note, createdBy });

    const data = await calculateForDepartment(department);

    return NextResponse.json({
      success: true,
      message: "Payment recorded",
      payment,
      data,
    });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}