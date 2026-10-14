import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";

// Helper to calculate design stats
async function getDesignStats(design: string) {
  const barcodes = await Barcode.find({ design }).lean();
  if (!barcodes || barcodes.length === 0) {
    return null;
  }

  const hasDupatta = barcodes.some(
    (b: any) => b.item === "Dupatta" || b.suitType === "3pc"
  );
  const suitType: "2pc" | "3pc" = hasDupatta ? "3pc" : "2pc";
  const divisor = suitType === "3pc" ? 3 : 2;

  const SIZES = ["S", "M", "L"] as const;
  const sizeBreakdown: Record<string, any> = {};

  let totalSuits = 0;
  let totalCategoryA = 0;
  let totalCategoryB = 0;

  for (const size of SIZES) {
    const sizeBarcodes = barcodes.filter((b: any) => b.size === size);
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
    let defectivePiecesCount = sizeBarcodes.filter(
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

// GET - Get list of designs available for final sticker generation or preview stats for a design
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

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

    // Get all unique designs from barcodes
    const allDesigns = await Barcode.distinct("design");

    // Get designs that already have final stickers generated
    const designsWithStickers = await FinalSticker.distinct("design");

    // Separate designs into two categories
    const availableDesigns = allDesigns.filter(
      (design: string) => !designsWithStickers.includes(design)
    );

    const generatedDesigns = designsWithStickers;

    // Get count of stickers per design that are already generated
    const stickerCounts = await FinalSticker.aggregate([
      {
        $group: {
          _id: "$design",
          count: { $sum: 1 },
          categoryA: {
            $sum: { $cond: [{ $eq: ["$category", "A"] }, 1, 0] },
          },
          categoryB: {
            $sum: { $cond: [{ $eq: ["$category", "B"] }, 1, 0] },
          },
        },
      },
    ]);

    const stickerCountMap: Record<string, { total: number; catA: number; catB: number }> = {};
    stickerCounts.forEach((item: any) => {
      stickerCountMap[item._id] = {
        total: item.count,
        catA: item.categoryA,
        catB: item.categoryB,
      };
    });

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
