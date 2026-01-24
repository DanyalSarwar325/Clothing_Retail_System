import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";

// GET - Get all products for a specific design with their department history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ design: string }> }
) {
  try {
    await DbConnect();

    const { design } = await params;
    const decodedDesign = decodeURIComponent(design);

    // Get all barcodes for this design
    const barcodes = await Barcode.find({ design: decodedDesign })
      .sort({ size: 1, item: 1, unitNumber: 1 })
      .lean();

    // Get all final stickers for this design
    const finalStickers = await FinalSticker.find({ design: decodedDesign })
      .sort({ size: 1, unitNumber: 1 })
      .lean();

    // Group barcodes by unit
    const units: Record<string, any> = {};

    barcodes.forEach((barcode: any) => {
      const unitKey = `${barcode.size}-${barcode.unitNumber}`;
      if (!units[unitKey]) {
        units[unitKey] = {
          size: barcode.size,
          unitNumber: barcode.unitNumber,
          items: [],
        };
      }
      units[unitKey].items.push({
        id: barcode._id,
        item: barcode.item,
        currentDepartment: barcode.currentDepartment,
        status: barcode.status,
        departmentHistory: barcode.departmentHistory || [],
        createdAt: barcode.createdAt,
        scannedAt: barcode.scannedAt,
      });
    });

    // Map final stickers as individual cards
    const finalStickerCards = finalStickers.map((sticker: any) => ({
      id: sticker._id,
      size: sticker.size,
      unitNumber: sticker.unitNumber,
      suitType: sticker.suitType,
      sellingPrice: sticker.sellingPrice,
      currentDepartment: sticker.currentDepartment,
      status: sticker.status,
      departmentHistory: sticker.departmentHistory || [],
      createdAt: sticker.createdAt,
    }));

    return NextResponse.json({
      success: true,
      design: decodedDesign,
      units: Object.values(units),
      finalStickers: finalStickerCards,
      totalItems: barcodes.length,
      totalFinalStickers: finalStickers.length,
    });
  } catch (error: any) {
    console.error("Design details error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch design details" },
      { status: 500 }
    );
  }
}
