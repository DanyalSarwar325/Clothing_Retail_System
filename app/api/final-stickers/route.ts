import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";
import Barcode from "@/app/libs/models/barcode";

// GET - Get all final stickers or filter by design/category/status
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const status = searchParams.get("status");
    const category = searchParams.get("category"); // "A" or "B"

    const filter: any = {};
    if (design) filter.design = design;
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Sort by design, category ("A" first, then "B"), size, unitNumber
    const stickers = await FinalSticker.find(filter).sort({
      design: 1,
      category: 1,
      size: 1,
      unitNumber: 1,
    });

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

// POST - Generate final stickers for a design with automatic 2pc/3pc detection & Category A/B grouping
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

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

    // Validate department rates
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

    // Check if final stickers already exist for this design
    const existingStickers = await FinalSticker.findOne({ design });
    if (existingStickers) {
      return NextResponse.json(
        { success: false, message: "Final stickers already generated for this design. Delete existing ones to regenerate." },
        { status: 400 }
      );
    }

    // Fetch all barcodes for this design
    const barcodes = await Barcode.find({ design }).sort({ size: 1, unitNumber: 1 }).lean();

    if (!barcodes || barcodes.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes found for this design" },
        { status: 404 }
      );
    }

    // Automatically detect suitType: if any barcode has item === "Dupatta" or suitType === "3pc", it's 3pc; otherwise 2pc
    const hasDupatta = barcodes.some(
      (b: any) => b.item === "Dupatta" || b.suitType === "3pc"
    );
    const detectedSuitType = hasDupatta ? "3pc" : "2pc";
    const divisor = detectedSuitType === "3pc" ? 3 : 2;

    const SIZES = ["S", "M", "L"] as const;
    const catAStickers: any[] = [];
    const catBStickers: any[] = [];

    let totalGlobalSuits = 0;

    for (const size of SIZES) {
      const sizeBarcodes = barcodes.filter((b: any) => b.size === size);
      if (sizeBarcodes.length === 0) continue;

      // Group barcodes by unitNumber
      const unitMap = new Map<number, any[]>();
      for (const b of sizeBarcodes) {
        const uNum = b.unitNumber || 1;
        if (!unitMap.has(uNum)) unitMap.set(uNum, []);
        unitMap.get(uNum)!.push(b);
      }

      const totalSuitsForSize = Math.floor(sizeBarcodes.length / divisor);
      if (totalSuitsForSize === 0) continue;

      // Extract unique unit numbers present, sorted
      const sortedUnitNumbers = Array.from(unitMap.keys()).sort((a, b) => a - b);

      for (let i = 0; i < totalSuitsForSize; i++) {
        const unitNum = sortedUnitNumbers[i] !== undefined ? sortedUnitNumbers[i] : i + 1;
        const pieces = unitMap.get(unitNum) || [];

        // Check if ANY piece in this unit is defective or damaged
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
            .map((dp: any) => `${dp.item}: ${dp.defectiveInfo?.reason || "Defective"}`)
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
          componentBarcodeIds: pieces.map((p: any) => p._id.toString()),
          unitNumber: unitNum,
          sellingPrice,
          departmentRates: [
            { department: "Packing", ratePerPiece: departmentRates.Packing || 0 },
            { department: "Store", ratePerPiece: departmentRates.Store || 0 },
          ],
          barcodeData: JSON.stringify(barcodePayload),
          status: "generated",
          currentDepartment: "Press",
          departmentHistory: [],
        };

        if (category === "A") {
          catAStickers.push(stickerDoc);
        } else {
          catBStickers.push(stickerDoc);
        }
      }
    }

    // Grouping rule: All Category A first, followed by Category B
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

    const createdStickers = await FinalSticker.insertMany(allStickersToCreate);

    return NextResponse.json({
      success: true,
      message: `Generated ${createdStickers.length} final stickers for "${design}" (${detectedSuitType}): ${catAStickers.length} Category A (OK) and ${catBStickers.length} Category B (Defective)`,
      stickers: createdStickers,
      count: createdStickers.length,
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

// DELETE - Delete all final stickers for a design (for regeneration)
export async function DELETE(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    const result = await FinalSticker.deleteMany({ design });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} final stickers for design "${design}"`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
