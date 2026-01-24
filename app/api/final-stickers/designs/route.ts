import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";

// GET - Get list of designs available for final sticker generation
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

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
        },
      },
    ]);

    const stickerCountMap: Record<string, number> = {};
    stickerCounts.forEach((item: any) => {
      stickerCountMap[item._id] = item.count;
    });

    return NextResponse.json({
      success: true,
      availableDesigns, // Designs that don't have final stickers yet
      generatedDesigns, // Designs that already have final stickers
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
