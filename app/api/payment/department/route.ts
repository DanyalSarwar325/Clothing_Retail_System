import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";
import Payment from "@/app/libs/models/payment";

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

async function calculateForDepartment(department: string) {
  const rateDoc = await Rate.findOne({ department });
  const fallbackRate = rateDoc?.ratePerUnit || 0;

  // For Cutting department: only count 'scanned' barcodes
  // For other departments: count all scans
  const matchStage: any = {};
  if (department === "Cutting") {
    matchStage.status = "scanned";
  }

  // Aggregate with design-specific rates
  const scansAgg = await Barcode.aggregate([
    { $match: matchStage },
    { $unwind: "$departmentHistory" },
    { $match: { "departmentHistory.department": department } },
    {
      $project: {
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
        totalScans: { $sum: 1 },
        totalDue: { $sum: "$designRate" },
      },
    },
  ]);

  const totalScans = scansAgg?.[0]?.totalScans || 0;
  const totalDue = scansAgg?.[0]?.totalDue || 0;

  const paymentsAgg = await Payment.aggregate([
    { $match: { department } },
    { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
  ]);
  const totalPaid = paymentsAgg?.[0]?.totalPaid || 0;

  const pending = Math.max(totalDue - totalPaid, 0);

  return {
    department,
    fallbackRate,
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