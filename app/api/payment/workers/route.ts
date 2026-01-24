import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Payment from "@/app/libs/models/payment";
import Rate from "@/app/libs/models/rate";

// GET - Get all workers in a department with their payment details
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "department is required" },
        { status: 400 }
      );
    }

    // Get fallback rate for this department
    const rateDoc = await Rate.findOne({ department });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Match condition based on department
    const matchCondition: any = {
      "departmentHistory.department": department,
    };

    // Get all workers who scanned in this department with their earnings
    const workersAgg = await Barcode.aggregate([
      { $match: matchCondition },
      { $unwind: "$departmentHistory" },
      { $match: { "departmentHistory.department": department } },
      {
        $project: {
          workerName: "$departmentHistory.scannedBy",
          scannedAt: "$departmentHistory.scannedAt",
          design: 1,
          departmentRates: 1,
          // Find the rate for this specific department
          earnedAmount: {
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
          _id: "$workerName",
          totalScans: { $sum: 1 },
          totalEarned: { $sum: "$earnedAmount" },
          lastScanAt: { $max: "$scannedAt" },
        },
      },
      {
        $match: { _id: { $ne: null } }, // Filter out null worker names
      },
      {
        $sort: { totalEarned: -1 },
      },
    ]);

    // Get total payments made to each worker in this department
    const paymentsAgg = await Payment.aggregate([
      { $match: { department } },
      {
        $group: {
          _id: "$workerName",
          totalPaid: { $sum: "$amount" },
          lastPaymentAt: { $max: "$createdAt" },
        },
      },
    ]);

    // Create a map of payments by worker
    const paymentsMap = new Map(
      paymentsAgg.map((p) => [p._id, { totalPaid: p.totalPaid, lastPaymentAt: p.lastPaymentAt }])
    );

    // Combine workers with their payment info
    const workers = workersAgg.map((worker) => {
      const payments = paymentsMap.get(worker._id) || { totalPaid: 0, lastPaymentAt: null };
      const pending = Math.max(worker.totalEarned - payments.totalPaid, 0);

      return {
        workerName: worker._id,
        totalScans: worker.totalScans,
        totalEarned: worker.totalEarned,
        totalPaid: payments.totalPaid,
        pending,
        lastScanAt: worker.lastScanAt,
        lastPaymentAt: payments.lastPaymentAt,
      };
    });

    // Calculate department totals
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
    await DbConnect();

    const { department, workerName, amount, note, createdBy } = await request.json();

    if (!department || !workerName || amount === undefined) {
      return NextResponse.json(
        { success: false, message: "department, workerName, and amount are required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await Payment.create({
      department,
      workerName,
      amount,
      note,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      message: `Payment of ₨${amount} recorded for ${workerName}`,
      payment,
    });
  } catch (error: any) {
    console.error("Error recording worker payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
