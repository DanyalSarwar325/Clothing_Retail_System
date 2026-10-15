import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET - Get all workers in a department with their payment details
export async function GET(request: NextRequest) {
  try {
    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "department is required" },
        { status: 400 }
      );
    }

    // Get fallback rate for this department
    const rateDoc = await prisma.rate.findUnique({ where: { department } });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Fetch all scans for this department
    const scans = await prisma.barcodeScan.findMany({
      where: {
        department,
        scannedBy: { not: null },
      },
      include: {
        barcode: {
          include: {
            departmentRates: { where: { department } },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
    });

    // Group scans by worker
    const workerMap: Record<
      string,
      { totalScans: number; totalEarned: number; lastScanAt: Date | null }
    > = {};

    for (const scan of scans) {
      const workerName = scan.scannedBy!;
      if (!workerMap[workerName]) {
        workerMap[workerName] = {
          totalScans: 0,
          totalEarned: 0,
          lastScanAt: scan.scannedAt,
        };
      }

      const barcode = scan.barcode;
      const matchedRate =
        barcode.departmentRates.find((r) => r.item === barcode.item) ||
        barcode.departmentRates[0];
      const rate = matchedRate ? matchedRate.ratePerPiece : fallbackRate;

      workerMap[workerName].totalScans++;
      workerMap[workerName].totalEarned += rate;
    }

    // Fetch all payouts made to workers in this department
    const payouts = await prisma.workerPayoutRecord.findMany({
      where: { department },
      orderBy: { createdAt: "desc" },
    });

    const paymentsMap: Record<string, { totalPaid: number; lastPaymentAt: Date | null }> = {};
    for (const p of payouts) {
      if (!paymentsMap[p.workerName]) {
        paymentsMap[p.workerName] = { totalPaid: 0, lastPaymentAt: p.createdAt };
      }
      paymentsMap[p.workerName].totalPaid += p.amount;
    }

    const workers = Object.keys(workerMap).map((workerName) => {
      const workerData = workerMap[workerName];
      const paymentData = paymentsMap[workerName] || { totalPaid: 0, lastPaymentAt: null };
      const pending = Math.max(workerData.totalEarned - paymentData.totalPaid, 0);

      return {
        workerName,
        totalScans: workerData.totalScans,
        totalEarned: workerData.totalEarned,
        totalPaid: paymentData.totalPaid,
        pending,
        lastScanAt: workerData.lastScanAt,
        lastPaymentAt: paymentData.lastPaymentAt,
      };
    });

    workers.sort((a, b) => b.totalEarned - a.totalEarned);

    const departmentTotals = workers.reduce(
      (acc, w) => ({
        totalScans: acc.totalScans + w.totalScans,
        totalEarned: acc.totalEarned + w.totalEarned,
        totalPaid: acc.totalPaid + w.totalPaid,
        totalPending: acc.totalPending + w.pending,
      }),
      { totalScans: 0, totalEarned: 0, totalPaid: 0, totalPending: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        department,
        fallbackRate,
        workers,
        totals: departmentTotals,
      },
    });
  } catch (error: any) {
    console.error("Error fetching worker payments:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch worker payments" },
      { status: 500 }
    );
  }
}

// POST - Make payment to a specific worker
export async function POST(request: NextRequest) {
  try {
    const { department, workerName, amount, note, createdBy } = await request.json();

    if (!department || !workerName || amount === undefined) {
      return NextResponse.json(
        { success: false, message: "department, workerName, and amount are required" },
        { status: 400 }
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const payment = await prisma.workerPayoutRecord.create({
      data: {
        department,
        workerName,
        amount: Number(amount),
        note: note || null,
        createdBy: createdBy || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment of ₨${amount} recorded for ${workerName}`,
      payment: {
        ...payment,
        _id: payment.id,
      },
    });
  } catch (error: any) {
    console.error("Error recording worker payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
