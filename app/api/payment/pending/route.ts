import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

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

// GET - Calculate pending payment for a user in a department
export async function GET(request: NextRequest) {
  try {
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
    const globalRate = await prisma.rate.findUnique({
      where: { department },
    });
    const fallbackRate = globalRate?.ratePerUnit || 0;

    // Special handling for Packing and Store - uses FinalSticker model
    if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
      const scans = await prisma.finalStickerScan.findMany({
        where: {
          department,
          scannedBy: userName,
        },
        include: {
          finalSticker: {
            include: {
              departmentRates: {
                where: { department },
              },
              paidDepartments: {
                where: { department },
              },
            },
          },
        },
      });

      let totalPayment = 0;
      let pendingPayment = 0;
      let paidCount = 0;
      let pendingCount = 0;

      for (const s of scans) {
        const rateRecord = s.finalSticker.departmentRates[0];
        const rate = rateRecord?.ratePerPiece ?? fallbackRate;
        totalPayment += rate;

        const isPaid = s.finalSticker.paidDepartments.length > 0;
        if (isPaid) {
          paidCount++;
        } else {
          pendingCount++;
          pendingPayment += rate;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          userName,
          department,
          scanCount: scans.length,
          paidCount,
          pendingCount,
          ratePerUnit: fallbackRate,
          pendingPayment,
          totalPayment,
          note: `${department} payment calculated from final sticker scans`,
        },
      });
    }

    // Standard piece-rate departments (Cutting, Sewing, etc.)
    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    const scans = await prisma.barcodeScan.findMany({
      where: {
        department,
        scannedBy: userName,
      },
      include: {
        barcode: {
          include: {
            departmentRates: {
              where: { department },
            },
            paidDepartments: {
              where: { department },
            },
          },
        },
      },
    });

    let totalPayment = 0;
    let pendingPayment = 0;
    let paidCount = 0;

    for (const scan of scans) {
      const barcode = scan.barcode;
      // Match rate by item if applicable
      const matchedRateObj = usesItemBasedRates
        ? barcode.departmentRates.find((r) => r.item === barcode.item) || barcode.departmentRates[0]
        : barcode.departmentRates[0];

      const rate = matchedRateObj ? matchedRateObj.ratePerPiece : fallbackRate;
      totalPayment += rate;

      const isPaid = barcode.paidDepartments.length > 0;
      if (isPaid) {
        paidCount++;
      } else {
        pendingPayment += rate;
      }
    }

    const scanCount = scans.length;
    const pendingCount = scanCount - paidCount;

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        scanCount,
        paidCount,
        pendingCount,
        ratePerUnit: fallbackRate,
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
