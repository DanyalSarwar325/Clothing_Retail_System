import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const status = searchParams.get("status");
    const category = searchParams.get("category"); // "A" or "B"

    const where: any = {};
    if (design) where.design = design;
    if (status) where.status = status;
    if (category) where.category = category;

    const rawStickers = await prisma.finalSticker.findMany({
      where,
      include: {
        departmentRates: true,
        paidDepartments: true,
        departmentHistory: true,
      },
      orderBy: [
        { design: "asc" },
        { category: "asc" },
        { size: "asc" },
        { unitNumber: "asc" },
      ],
    });

    const stickers = rawStickers.map((s) => ({
      ...s,
      _id: s.id,
      departmentRates: s.departmentRates.map((r) => ({
        _id: r.id,
        department: r.department,
        ratePerPiece: r.ratePerPiece,
      })),
      paidDepartments: s.paidDepartments.map((p) => ({
        _id: p.id,
        department: p.department,
        amount: p.amount,
        paidAt: p.paidAt,
        paidBy: p.paidBy,
      })),
      departmentHistory: s.departmentHistory.map((h) => ({
        _id: h.id,
        department: h.department,
        scannedAt: h.scannedAt,
        scannedBy: h.scannedBy,
      })),
    }));

    const categoryACount = stickers.filter((s: any) => s.category === "A").length;
    const categoryBCount = stickers.filter((s: any) => s.category === "B").length;

    return NextResponse.json({
      success: true,
      stickers,
      count: stickers.length,
      categoryACount,
      categoryBCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { design, sellingPrice, departmentRates } = body;

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    if (!sellingPrice || sellingPrice <= 0) {
      return NextResponse.json(
        { success: false, message: "Selling price is required" },
        { status: 400 }
      );
    }

    if (
      !departmentRates ||
      departmentRates.Packing < 0 ||
      departmentRates.Store < 0 ||
      departmentRates.Packing === undefined ||
      departmentRates.Store === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "Packing and Store rates are required" },
        { status: 400 }
      );
    }

    const existingStickers = await prisma.finalSticker.findFirst({
      where: { design },
    });
    if (existingStickers) {
      return NextResponse.json(
        { success: false, message: "Final stickers already generated for this design. Delete existing ones to regenerate." },
        { status: 400 }
      );
    }

    const barcodes = await prisma.barcode.findMany({
      where: { design },
      orderBy: [{ size: "asc" }, { unitNumber: "asc" }],
    });

    if (!barcodes || barcodes.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes found for this design" },
        { status: 404 }
      );
    }

    const hasDupatta = barcodes.some(
      (b) => b.item === "Dupatta" || b.suitType === "3pc"
    );
    const detectedSuitType = hasDupatta ? "3pc" : "2pc";
    const divisor = detectedSuitType === "3pc" ? 3 : 2;

    const SIZES = ["S", "M", "L"] as const;
    const catAStickers: any[] = [];
    const catBStickers: any[] = [];

    let totalGlobalSuits = 0;

    for (const size of SIZES) {
      const sizeBarcodes = barcodes.filter((b) => b.size === size);
      if (sizeBarcodes.length === 0) continue;

      const unitMap = new Map<number, any[]>();
      for (const b of sizeBarcodes) {
        const uNum = b.unitNumber || 1;
        if (!unitMap.has(uNum)) unitMap.set(uNum, []);
        unitMap.get(uNum)!.push(b);
      }

      const totalSuitsForSize = Math.floor(sizeBarcodes.length / divisor);
      if (totalSuitsForSize === 0) continue;

      const sortedUnitNumbers = Array.from(unitMap.keys()).sort((a, b) => a - b);

      for (let i = 0; i < totalSuitsForSize; i++) {
        const unitNum = sortedUnitNumbers[i] !== undefined ? sortedUnitNumbers[i] : i + 1;
        const pieces = unitMap.get(unitNum) || [];

        const defectivePieces = pieces.filter(
          (p: any) =>
            p.status === "defective" ||
            p.status === "damaged" ||
            !!p.defectiveInfo
        );

        const isUnitDefective = defectivePieces.length > 0;
        const category = isUnitDefective ? "B" : "A";
        const categoryLabel = isUnitDefective ? "Category B - Defective" : "Category A - OK Quality";

        let defectSummary = "";
        if (isUnitDefective) {
          defectSummary = defectivePieces
            .map((dp: any) => `${dp.item}: ${(dp.defectiveInfo as any)?.reason || "Defective"}`)
            .join("; ");
        }

        totalGlobalSuits++;

        const barcodePayload = {
          type: "final",
          category,
          design,
          size,
          suitType: detectedSuitType,
          unitNumber: unitNum,
          sellingPrice,
          isDefective: isUnitDefective,
          timestamp: Date.now() + totalGlobalSuits,
        };

        const stickerDoc = {
          design,
          size,
          suitType: detectedSuitType,
          category,
          categoryLabel,
          isDefective: isUnitDefective,
          defectSummary: defectSummary || undefined,
          componentBarcodeIds: pieces.map((p: any) => p.id),
          unitNumber: unitNum,
          sellingPrice,
          barcodeData: JSON.stringify(barcodePayload),
          status: "generated",
          currentDepartment: "Press",
        };

        if (category === "A") {
          catAStickers.push(stickerDoc);
        } else {
          catBStickers.push(stickerDoc);
        }
      }
    }

    const allStickersToCreate = [...catAStickers, ...catBStickers];

    if (allStickersToCreate.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Not enough barcodes to create ${detectedSuitType} stickers. Need at least ${divisor} pieces per size.`,
        },
        { status: 400 }
      );
    }

    const createdStickers = await prisma.$transaction(
      allStickersToCreate.map((st) =>
        prisma.finalSticker.create({
          data: {
            ...st,
            departmentRates: {
              create: [
                { department: "Packing", ratePerPiece: departmentRates.Packing || 0 },
                { department: "Store", ratePerPiece: departmentRates.Store || 0 },
              ],
            },
          },
          include: {
            departmentRates: true,
          },
        })
      )
    );

    const formattedCreated = createdStickers.map((s) => ({
      ...s,
      _id: s.id,
      departmentRates: s.departmentRates.map((r) => ({
        _id: r.id,
        department: r.department,
        ratePerPiece: r.ratePerPiece,
      })),
    }));

    return NextResponse.json({
      success: true,
      message: `Generated ${formattedCreated.length} final stickers for "${design}" (${detectedSuitType}): ${catAStickers.length} Category A (OK) and ${catBStickers.length} Category B (Defective)`,
      stickers: formattedCreated,
      count: formattedCreated.length,
      categoryACount: catAStickers.length,
      categoryBCount: catBStickers.length,
      suitType: detectedSuitType,
    });
  } catch (error: any) {
    console.error("Error generating final stickers:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    const result = await prisma.finalSticker.deleteMany({
      where: { design },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} final stickers for design "${design}"`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
