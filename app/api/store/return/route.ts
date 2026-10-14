import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// POST - Return an item to store inventory
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { stickerId, barcodeData, returnedBy, remarks } = body;

    if (!stickerId && !barcodeData) {
      return NextResponse.json(
        { success: false, message: "Sticker ID or barcode data is required" },
        { status: 400 }
      );
    }

    let sticker = null;

    if (stickerId) {
      sticker = await FinalSticker.findById(stickerId);
    } else if (barcodeData) {
      let parsedData = null;
      try {
        parsedData = JSON.parse(barcodeData);
      } catch {
        parsedData = null;
      }

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
        sticker = await FinalSticker.findOne({
          $or: [
            { barcodeData },
            ...(barcodeData.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: barcodeData }] : [])
          ]
        });
      }
    }

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found" },
        { status: 404 }
      );
    }

    const prevStatus = sticker.status;
    const previouslyReceived = sticker.paymentInfo?.amountReceived || 0;

    // Record return info
    sticker.returnInfo = {
      returnedAt: new Date(),
      returnedBy: returnedBy || "Store",
      remarks: remarks?.trim() || "Item returned to Store inventory",
      previousStatus: prevStatus,
    };

    // Reset payment info and subtract/reverse any revenue recorded
    sticker.paymentInfo = {
      isPaid: false,
      amountReceived: 0,
      notes: previouslyReceived > 0 
        ? `Returned on ${new Date().toLocaleDateString()}. Reversed revenue of Rs. ${previouslyReceived}. Notes: ${remarks || ""}`
        : `Returned to store. Notes: ${remarks || ""}`,
    };

    // Clear dispatch info so item is no longer marked dispatched or credited
    sticker.dispatchInfo = undefined;

    // Move back to store inventory
    sticker.status = "in_store";
    sticker.currentDepartment = "Store";
    sticker.departmentHistory.push({
      department: "Store",
      scannedAt: new Date(),
      scannedBy: `${returnedBy || "Store"} (Return to Inventory)`,
    });

    await sticker.save();

    return NextResponse.json({
      success: true,
      message: `Item returned to Store inventory: ${sticker.design} - ${sticker.suitType} - Unit #${sticker.unitNumber}. Inventory increased by 1 and revenue subtracted.`,
      reversedRevenue: previouslyReceived,
      sticker,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
