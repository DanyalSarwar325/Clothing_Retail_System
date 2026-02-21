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
    const { design, sellingPrice, suitType, departmentRates } = body;

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

    if (!suitType || !["2pc", "3pc"].includes(suitType)) {
      return NextResponse.json(
        { success: false, message: "Suit type must be 2pc or 3pc" },
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

    // Get total barcodes per size for this design
    const sizeGroups = await Barcode.aggregate([
      { $match: { design } },
      {
        $group: {
          _id: "$size",
          totalBarcodes: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    if (sizeGroups.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes found for this design" },
        { status: 404 }
      );
    }

    const divisor = suitType === "2pc" ? 2 : 3;

    // Generate final stickers: for each size, total barcodes / divisor = number of stickers
    const stickersToCreate: any[] = [];

    for (const group of sizeGroups) {
      const size = group._id; // "S", "M", or "L"
      const totalBarcodesForSize = group.totalBarcodes;
      const stickerCount = Math.floor(totalBarcodesForSize / divisor);

      for (let i = 1; i <= stickerCount; i++) {
        // Generate unique barcode data for final sticker
        const barcodePayload = {
          type: "final",
          design,
          size,
          suitType,
          unitNumber: i,
          sellingPrice,
          timestamp: Date.now() + stickersToCreate.length, // ensure uniqueness
        };

        stickersToCreate.push({
          design,
          size,
          suitType,
          unitNumber: i,
          sellingPrice,
          departmentRates: [
            { department: "Packing", ratePerPiece: departmentRates.Packing || 0 },
            { department: "Store", ratePerPiece: departmentRates.Store || 0 },
          ],
          barcodeData: JSON.stringify(barcodePayload),
          status: "generated",
          currentDepartment: "Press",
          departmentHistory: [],
        });
      }
    }

    if (stickersToCreate.length === 0) {
      return NextResponse.json(
        { success: false, message: `Not enough barcodes per size to create ${suitType} stickers. Need at least ${divisor} barcodes per size.` },
        { status: 400 }
      );
    }

    const createdStickers = await FinalSticker.insertMany(stickersToCreate);

    return NextResponse.json({
      success: true,
      message: `Generated ${createdStickers.length} final stickers for design "${design}" (${suitType})`,
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
