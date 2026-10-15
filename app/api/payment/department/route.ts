import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
  "Packing",
  "Store",
];

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

const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

async function calculateForDepartment(department: string) {
  const rateDoc = await prisma.rate.findUnique({ where: { department } });
  const fallbackRate = rateDoc?.ratePerUnit || 0;

  if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
    const scans = await prisma.finalStickerScan.findMany({
      where: { department },
      include: {
        finalSticker: {
          include: {
            departmentRates: { where: { department } },
            paidDepartments: { where: { department } },
          },
        },
      },
    });

    let totalDue = 0;
    let totalPaid = 0;
    let pending = 0;

    for (const s of scans) {
      const rate = s.finalSticker.departmentRates[0]?.ratePerPiece ?? fallbackRate;
      totalDue += rate;
      if (s.finalSticker.paidDepartments.length > 0) {
        totalPaid += rate;
      } else {
        pending += rate;
      }
    }

    return {
      department,
      ratePerUnit: fallbackRate,
      totalScans: scans.length,
      totalPaid,
      totalDue,
      pending,
    };
  }

  // Standard piece rate departments
  const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);
  const scans = await prisma.barcodeScan.findMany({
    where: { department },
    include: {
      barcode: {
        include: {
          departmentRates: { where: { department } },
          paidDepartments: { where: { department } },
        },
      },
    },
  });

  let totalDue = 0;
  let totalPaid = 0;
  let pending = 0;

  for (const s of scans) {
    const b = s.barcode;
    const matchedRate = usesItemBasedRates
      ? b.departmentRates.find((r) => r.item === b.item) || b.departmentRates[0]
      : b.departmentRates[0];
    const rate = matchedRate ? matchedRate.ratePerPiece : fallbackRate;

    totalDue += rate;
    if (b.paidDepartments.length > 0) {
      totalPaid += rate;
    } else {
      pending += rate;
    }
  }

  return {
    department,
    ratePerUnit: fallbackRate,
    totalScans: scans.length,
    totalPaid,
    totalDue,
    pending,
  };
}

export async function GET(request: NextRequest) {
  try {
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
    const { department, amount, note, createdBy } = await request.json();

    if (!department || amount === undefined) {
      return NextResponse.json(
        { success: false, message: "Department and amount are required" },
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
        workerName: department,
        amount: Number(amount),
        note: note || null,
        createdBy: createdBy || null,
      },
    });

    const data = await calculateForDepartment(department);

    return NextResponse.json({
      success: true,
      message: "Payment recorded",
      payment: {
        ...payment,
        _id: payment.id,
      },
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