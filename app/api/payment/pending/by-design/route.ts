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

    const globalRate = await prisma.rate.findUnique({ where: { department } });
    const fallbackRate = globalRate?.ratePerUnit || 0;

    if (FINAL_STICKER_DEPARTMENTS.includes(department)) {
      const stickers = await prisma.finalSticker.findMany({
        where: {
          departmentHistory: {
            some: {
              department,
              scannedBy: userName,
            },
          },
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
        },
      });

      const designMap: Record<string, { scanCount: number; pendingPayment: number; totalPayment: number; rates: number[] }> = {};

      for (const sticker of stickers) {
        const matchingScans = sticker.departmentHistory.filter(
          (h) => h.department === department && h.scannedBy === userName
        );

        const matchedRate = sticker.departmentRates.find((r) => r.department === department);
        const rate = matchedRate?.ratePerPiece ?? fallbackRate;

        if (!designMap[sticker.design]) {
          designMap[sticker.design] = { scanCount: 0, pendingPayment: 0, totalPayment: 0, rates: [] };
        }

        const count = matchingScans.length;
        designMap[sticker.design].scanCount += count;
        designMap[sticker.design].pendingPayment += count * rate;
        designMap[sticker.design].totalPayment += count * rate;
        designMap[sticker.design].rates.push(rate);
      }

      const perDesign = Object.entries(designMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([design, d]) => ({
          design,
          scanCount: d.scanCount,
          pendingCount: d.scanCount,
          paidCount: 0,
          ratePerUnit: d.rates.length > 0 ? d.rates[0] : fallbackRate,
          pendingPayment: d.pendingPayment,
          totalPayment: d.totalPayment,
        }));

      const allRates = perDesign.map((r) => r.ratePerUnit);
      const uniqueRates = [...new Set(allRates)];
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

    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    const barcodes = await prisma.barcode.findMany({
      where: {
        departmentHistory: {
          some: {
            department,
            scannedBy: userName,
          },
        },
      },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    const designMap: Record<
      string,
      {
        scanCount: number;
        totalPayment: number;
        pendingPayment: number;
        pendingCount: number;
        paidCount: number;
        rates: number[];
      }
    > = {};

    for (const barcode of barcodes) {
      const isPaid = barcode.paidDepartments.some((pd) => pd.department === department);

      let designRate = fallbackRate;
      if (usesItemBasedRates) {
        const itemMatch = barcode.departmentRates.find(
          (r) => r.department === department && r.item === barcode.item
        );
        if (itemMatch && typeof itemMatch.ratePerPiece === "number") {
          designRate = itemMatch.ratePerPiece;
        }
      } else {
        const deptMatch = barcode.departmentRates.find((r) => r.department === department);
        if (deptMatch && typeof deptMatch.ratePerPiece === "number") {
          designRate = deptMatch.ratePerPiece;
        }
      }

      const matchingScans = barcode.departmentHistory.filter(
        (h) => h.department === department && h.scannedBy === userName
      );

      if (!designMap[barcode.design]) {
        designMap[barcode.design] = {
          scanCount: 0,
          totalPayment: 0,
          pendingPayment: 0,
          pendingCount: 0,
          paidCount: 0,
          rates: [],
        };
      }

      const group = designMap[barcode.design];
      const count = matchingScans.length;
      group.scanCount += count;
      group.totalPayment += count * designRate;
      group.rates.push(designRate);

      if (isPaid) {
        group.paidCount += count;
      } else {
        group.pendingCount += count;
        group.pendingPayment += count * designRate;
      }
    }

    const perDesign = Object.entries(designMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([design, d]) => ({
        design,
        scanCount: d.scanCount,
        pendingCount: d.pendingCount,
        paidCount: d.paidCount,
        ratePerUnit: usesItemBasedRates ? null : (d.rates[0] ?? fallbackRate),
        pendingPayment: d.pendingPayment,
        totalPayment: d.totalPayment,
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
