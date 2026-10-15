import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "Department is required" },
        { status: 400 }
      );
    }

    const rateDoc = await prisma.rate.findUnique({ where: { department } });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    const barcodes = await prisma.barcode.findMany({
      where: {
        departmentHistory: {
          some: { department },
        },
      },
      include: {
        departmentHistory: true,
        departmentRates: true,
      },
    });

    const designMap: Record<
      string,
      {
        scanCount: number;
        totalAmount: number;
        ratePerPiece: number;
      }
    > = {};

    for (const barcode of barcodes) {
      const matchingScans = barcode.departmentHistory.filter((h) => h.department === department);
      if (matchingScans.length === 0) continue;

      const itemRateMatch = barcode.departmentRates.find(
        (r) => r.department === department && r.item === barcode.item
      );
      const deptRateMatch = barcode.departmentRates.find(
        (r) => r.department === department
      );
      const rate = itemRateMatch?.ratePerPiece ?? deptRateMatch?.ratePerPiece ?? fallbackRate;

      if (!designMap[barcode.design]) {
        designMap[barcode.design] = {
          scanCount: 0,
          totalAmount: 0,
          ratePerPiece: rate,
        };
      }

      const count = matchingScans.length;
      designMap[barcode.design].scanCount += count;
      designMap[barcode.design].totalAmount += count * rate;
    }

    const designBreakdown = Object.entries(designMap)
      .map(([design, val]) => ({
        design,
        scanCount: val.scanCount,
        ratePerPiece: val.ratePerPiece,
        amount: val.totalAmount,
      }))
      .sort((a, b) => b.scanCount - a.scanCount);

    const totalScans = designBreakdown.reduce((sum, item) => sum + item.scanCount, 0);
    const totalAmount = designBreakdown.reduce((sum, item) => sum + item.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        department,
        fallbackRate,
        totalScans,
        totalAmount,
        designs: designBreakdown,
        note: "Using design-specific rates when available",
      },
    });
  } catch (error: any) {
    console.error("Error fetching department breakdown:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch breakdown" },
      { status: 500 }
    );
  }
}
