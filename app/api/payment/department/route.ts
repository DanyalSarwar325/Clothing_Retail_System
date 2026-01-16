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
  const ratePerUnit = rateDoc?.ratePerUnit || 0;

  const scansAgg = await Barcode.aggregate([
    { $unwind: "$departmentHistory" },
    { $match: { "departmentHistory.department": department } },
    { $group: { _id: null, total: { $sum: 1 } } },
  ]);
  const totalScans = scansAgg?.[0]?.total || 0;

  const paymentsAgg = await Payment.aggregate([
    { $match: { department } },
    { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
  ]);
  const totalPaid = paymentsAgg?.[0]?.totalPaid || 0;

  const totalDue = totalScans * ratePerUnit;
  const pending = Math.max(totalDue - totalPaid, 0);

  return {
    department,
    ratePerUnit,
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