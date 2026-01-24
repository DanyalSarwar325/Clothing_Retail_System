import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// POST - Mark payment received for a dispatched item
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { stickerId, amountReceived, receivedBy, notes } = body;

    if (!stickerId) {
      return NextResponse.json(
        { success: false, message: "Sticker ID is required" },
        { status: 400 }
      );
    }

    // Find the final sticker
    const sticker = await FinalSticker.findById(stickerId);

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Sticker not found" },
        { status: 404 }
      );
    }

    // Check if item is dispatched (can receive payment)
    if (sticker.status !== "dispatched") {
      return NextResponse.json({
        success: false,
        message: `Cannot receive payment: Item status is "${sticker.status}". Only dispatched items can receive payment.`,
        sticker,
      });
    }

    const amount = amountReceived || sticker.sellingPrice;

    // Update sticker status to delivered and mark payment
    sticker.status = "delivered";
    sticker.paymentInfo = {
      isPaid: true,
      amountReceived: amount,
      paidAt: new Date(),
      receivedBy: receivedBy || "Admin",
      notes: notes || undefined,
    };

    await sticker.save();

    return NextResponse.json({
      success: true,
      message: `Payment received: PKR ${amount.toLocaleString()} for ${sticker.design} - ${sticker.suitType} - Unit #${sticker.unitNumber}`,
      sticker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
