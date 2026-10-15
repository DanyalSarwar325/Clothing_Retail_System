import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

async function getDesignStats(design: string) {
  const barcodes = await prisma.barcode.findMany({
    where: { design },
  });
  if (!barcodes || barcodes.length === 0) {
    return null;
  }

  const hasDupatta = barcodes.some(
    (b) => b.item === "Dupatta" || b.suitType === "3pc"
  );
  const suitType: "2pc" | "3pc" = hasDupatta ? "3pc" : "2pc";
  const divisor = suitType === "3pc" ? 3 : 2;

  const SIZES = ["S", "M", "L"] as const;
  const sizeBreakdown: Record<string, any> = {};

  let totalSuits = 0;
  let totalCategoryA = 0;
  let totalCategoryB = 0;

  for (const size of SIZES) {
    const sizeBarcodes = barcodes.filter((b) => b.size === size);
    if (sizeBarcodes.length === 0) {
      sizeBreakdown[size] = {
        totalPieces: 0,
        totalSuits: 0,
        categoryA: 0,
        categoryB: 0,
        defectivePieces: 0,
      };
      continue;
    }

    const unitMap = new Map<number, any[]>();
    for (const b of sizeBarcodes) {
      const uNum = b.unitNumber || 1;
      if (!unitMap.has(uNum)) unitMap.set(uNum, []);
      unitMap.get(uNum)!.push(b);
    }

    const suitsInSize = Math.floor(sizeBarcodes.length / divisor);
    const sortedUnitNumbers = Array.from(unitMap.keys()).sort((a, b) => a - b);

    let catA = 0;
    let catB = 0;
    const defectivePiecesCount = sizeBarcodes.filter(
      (b: any) => b.status === "defective" || b.status === "damaged" || !!b.defectiveInfo
    ).length;

    for (let i = 0; i < suitsInSize; i++) {
      const unitNum = sortedUnitNumbers[i] !== undefined ? sortedUnitNumbers[i] : i + 1;
      const pieces = unitMap.get(unitNum) || [];
      const isDefective = pieces.some(
        (p: any) => p.status === "defective" || p.status === "damaged" || !!p.defectiveInfo
      );

      if (isDefective) {
        catB++;
      } else {
        catA++;
      }
    }

    sizeBreakdown[size] = {
      totalPieces: sizeBarcodes.length,
      totalSuits: suitsInSize,
      categoryA: catA,
      categoryB: catB,
      defectivePieces: defectivePiecesCount,
    };

    totalSuits += suitsInSize;
    totalCategoryA += catA;
    totalCategoryB += catB;
  }

  return {
    design,
    suitType,
    totalPieces: barcodes.length,
    totalSuits,
    totalCategoryA,
    totalCategoryB,
    sizeBreakdown,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const designParam = searchParams.get("design");

    if (designParam) {
      const stats = await getDesignStats(designParam);
      if (!stats) {
        return NextResponse.json(
          { success: false, message: `No barcodes found for design "${designParam}"` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    const barcodeDesigns = await prisma.barcode.findMany({
      select: { design: true },
      distinct: ["design"],
    });
    const allDesigns = barcodeDesigns.map((b) => b.design);

    const stickerDesigns = await prisma.finalSticker.findMany({
      select: { design: true },
      distinct: ["design"],
    });
    const designsWithStickers = stickerDesigns.map((s) => s.design);

    const availableDesigns = allDesigns.filter(
      (design) => !designsWithStickers.includes(design)
    );
    const generatedDesigns = designsWithStickers;

    const allStickers = await prisma.finalSticker.findMany({
      select: {
        design: true,
        category: true,
      },
    });

    const stickerCountMap: Record<string, { total: number; catA: number; catB: number }> = {};
    for (const s of allStickers) {
      if (!stickerCountMap[s.design]) {
        stickerCountMap[s.design] = { total: 0, catA: 0, catB: 0 };
      }
      stickerCountMap[s.design].total++;
      if (s.category === "A") {
        stickerCountMap[s.design].catA++;
      } else if (s.category === "B") {
        stickerCountMap[s.design].catB++;
      }
    }

    return NextResponse.json({
      success: true,
      availableDesigns,
      generatedDesigns,
      stickerCounts: stickerCountMap,
      totalDesigns: allDesigns.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
