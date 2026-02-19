import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";
import Barcode from "@/app/libs/models/barcode";

// GET - Get all final stickers or filter by design
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const status = searchParams.get("status");

    const filter: any = {};
    if (design) filter.design = design;
    if (status) filter.status = status;

    const stickers = await FinalSticker.find(filter).sort({ design: 1, size: 1, unitNumber: 1 });

    return NextResponse.json({
      success: true,
      stickers,
      count: stickers.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST - Generate final stickers for a design
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { design, prices, departmentRates } = body;

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    if (!prices || (prices["1pc"] <= 0 && prices["2pc"] <= 0 && prices["3pc"] <= 0)) {
      return NextResponse.json(
        { success: false, message: "At least one selling price is required" },
        { status: 400 }
      );
    }

    // Validate department rates
    if (!departmentRates || departmentRates.Packing < 0 || departmentRates.Store < 0 || departmentRates.Packing === undefined || departmentRates.Store === undefined) {
      return NextResponse.json(
        { success: false, message: "Packing and Store rates are required" },
        { status: 400 }
      );
    }

    // Check if final stickers already exist for this design
    const existingStickers = await FinalSticker.findOne({ design });
    if (existingStickers) {
      return NextResponse.json(
        { success: false, message: "Final stickers already generated for this design" },
        { status: 400 }
      );
    }

    // Get all unique combinations from existing barcodes for this design
    // Group by design, size, suitType, and unitNumber to find all unique suits
    const suitCombinations = await Barcode.aggregate([
      { $match: { design } },
      {
        $group: {
          _id: {
            design: "$design",
            size: "$size",
            suitType: "$suitType",
            unitNumber: "$unitNumber",
          },
        },
      },
      {
        $sort: { "_id.size": 1, "_id.unitNumber": 1 },
      },
    ]);

    if (suitCombinations.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes found for this design" },
        { status: 404 }
      );
    }

    // Generate final stickers for each unique suit with global sequential numbering
    const totalSuits = suitCombinations.length;
    const stickersToCreate = suitCombinations.map((combo, index) => {
      const { design, size, suitType } = combo._id;
      const globalUnitNumber = index + 1; // Sequential: 1, 2, 3 ... N across all sizes

      // Get the selling price for this suit type
      const sellingPrice = prices[suitType] || 0;

      // Generate unique barcode data for final sticker
      const barcodePayload = {
        type: "final",
        design,
        size,
        suitType,
        unitNumber: globalUnitNumber,
        sellingPrice,
        timestamp: Date.now(),
      };

      return {
        design,
        size,
        suitType,
        unitNumber: globalUnitNumber,
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
    });

    const createdStickers = await FinalSticker.insertMany(stickersToCreate);

    return NextResponse.json({
      success: true,
      message: `Generated ${createdStickers.length} final stickers for design "${design}"`,
      stickers: createdStickers,
      count: createdStickers.length,
    });
  } catch (error: any) {
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
