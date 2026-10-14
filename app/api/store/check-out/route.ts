import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// POST - Check-out a final sticker from store (dispatch for delivery)
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const {
      barcodeData,
      dispatchedBy,
      customerName,
      customerPhone,
      customerAddress,
      checkoutType,
      remarks,
    } = body;

    if (!barcodeData) {
      return NextResponse.json(
        { success: false, message: "Barcode data is required" },
        { status: 400 }
      );
    }

    if (checkoutType && !["WholeSale", "Retail", "Cmd"].includes(checkoutType)) {
      return NextResponse.json(
        { success: false, message: "Invalid checkout type. Allowed: WholeSale, Retail, Cmd." },
        { status: 400 }
      );
    }

    // Parse barcode data to check if it's a final sticker
    let parsedData;
    try {
      parsedData = JSON.parse(barcodeData);
    } catch {
      parsedData = null;
    }

    let sticker = null;

    if (parsedData && parsedData.type === "final") {
      sticker = await FinalSticker.findOne({ barcodeData });
      if (!sticker && parsedData.design && parsedData.size && parsedData.unitNumber) {
        sticker = await FinalSticker.findOne({
          design: parsedData.design,
          size: parsedData.size,
          unitNumber: parsedData.unitNumber,
        });
      }
    } else {
      // Also allow lookup by exact barcodeData or _id if scanned/selected
      sticker = await FinalSticker.findOne({
        $or: [
          { barcodeData },
          ...(barcodeData.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: barcodeData }] : [])
        ]
      });
    }

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found in database" },
        { status: 404 }
      );
    }

    // Check if item is in store (can be dispatched)
    if (sticker.status !== "in_store") {
      return NextResponse.json({
        success: false,
        message: `Cannot checkout: Item status is "${sticker.status}". Only items in store can be checked out.`,
        sticker,
      });
    }

    // Update sticker status to dispatched
    sticker.status = "dispatched";
    sticker.dispatchInfo = {
      dispatchedAt: new Date(),
      dispatchedBy: dispatchedBy || "Store",
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerAddress: customerAddress || undefined,
      checkoutType: checkoutType || "Retail",
      remarks: remarks?.trim() || undefined,
    };

    // Initialize payment info
    sticker.paymentInfo = {
      isPaid: false,
      amountReceived: 0,
      notes: remarks?.trim() || undefined,
    };

    await sticker.save();

    return NextResponse.json({
      success: true,
      message: `Item checked out (${sticker.dispatchInfo.checkoutType}): ${sticker.design} - ${sticker.suitType} - Unit #${sticker.unitNumber}`,
      sticker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
