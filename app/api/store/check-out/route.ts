import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// POST - Check-out a final sticker from store (dispatch for delivery)
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeData, dispatchedBy, customerName, customerPhone, customerAddress } = body;

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
    const sticker = await FinalSticker.findOne({ barcodeData });

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found" },
        { status: 404 }
      );
    }

    // Check if item is in store (can be dispatched)
    if (sticker.status !== "in_store") {
      return NextResponse.json({
        success: false,
        message: `Cannot dispatch: Item status is "${sticker.status}". Only items in store can be dispatched.`,
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
    };

    // Initialize payment info
    sticker.paymentInfo = {
      isPaid: false,
      amountReceived: 0,
    };

    await sticker.save();

    return NextResponse.json({
      success: true,
      message: `Item dispatched for delivery: ${sticker.design} - ${sticker.suitType} - Unit #${sticker.unitNumber}`,
      sticker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
