import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Payment from "@/app/libs/models/payment";

// GET - Get payment history for a specific worker
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const workerName = request.nextUrl.searchParams.get("workerName");
    const department = request.nextUrl.searchParams.get("department");

    if (!workerName) {
      return NextResponse.json(
        { success: false, message: "workerName is required" },
        { status: 400 }
      );
    }

    const query: any = { workerName };
    if (department) {
      query.department = department;
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Calculate total paid
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        workerName,
        department: department || "all",
        payments,
        totalPaid,
        count: payments.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching payment history:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
