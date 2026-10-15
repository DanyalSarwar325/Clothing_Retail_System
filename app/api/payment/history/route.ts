import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET - Get payment history for a specific worker
export async function GET(request: NextRequest) {
  try {
    const workerName = request.nextUrl.searchParams.get("workerName");
    const department = request.nextUrl.searchParams.get("department");

    if (!workerName) {
      return NextResponse.json(
        { success: false, message: "workerName is required" },
        { status: 400 }
      );
    }

    const where: any = { workerName };
    if (department) {
      where.department = department;
    }

    const payments = await prisma.workerPayoutRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const formattedPayments = payments.map((p) => ({
      ...p,
      _id: p.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        workerName,
        department: department || "all",
        payments: formattedPayments,
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
