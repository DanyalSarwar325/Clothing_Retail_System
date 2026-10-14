import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// POST - Check-in a final sticker to store
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeData, scannedBy } = body;

    if (!barcodeData) {
      return NextResponse.json(
        { success: false, message: "Barcode data is required" },
        { status: 400 }
      );
    }

    // Parse barcode data to check if it's a final sticker
    let parsedData;
    try {
      parsedData = JSON.parse(barcodeData);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid barcode format" },
        { status: 400 }
      );
    }

    // Check if this is a final sticker barcode
    if (parsedData.type !== "final") {
      return NextResponse.json(
        { success: false, message: "This is not a final sticker barcode", isFinalSticker: false },
        { status: 400 }
      );
    }

    // Find the final sticker
    let sticker = await FinalSticker.findOne({ barcodeData });
    if (!sticker && parsedData.design && parsedData.size && parsedData.unitNumber) {
      sticker = await FinalSticker.findOne({
        design: parsedData.design,
        size: parsedData.size,
        unitNumber: parsedData.unitNumber,
      });
    }

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found in database" },
        { status: 404 }
      );
    }

    // Check if already in store
    if (sticker.status === "in_store") {
      return NextResponse.json({
        success: false,
        message: "This item is already in store",
        alreadyInStore: true,
        sticker,
      });
    }

    // Update sticker status to in_store
    sticker.status = "in_store";
    sticker.currentDepartment = "Store";
    sticker.departmentHistory.push({
      department: "Store",
      scannedAt: new Date(),
      scannedBy: scannedBy || undefined,
    });

    // Clear dispatch info if returning
    sticker.dispatchInfo = undefined;

    await sticker.save();

    return NextResponse.json({
      success: true,
      message: `Item checked in to store: ${sticker.design} - ${sticker.suitType} - Unit #${sticker.unitNumber}`,
      sticker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
