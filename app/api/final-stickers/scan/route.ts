import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker, { DEPARTMENTS, Department } from "@/app/libs/models/finalSticker";

// POST - Scan a final sticker
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeData, department, scannedBy } = body;

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

    // If department is provided, update the sticker
    if (department) {
      if (!DEPARTMENTS.includes(department as Department)) {
        return NextResponse.json(
          { success: false, message: "Invalid department" },
          { status: 400 }
        );
      }

      // Check if already scanned by this department
      const alreadyScanned = sticker.departmentHistory.some(
        (scan: any) => scan.department === department
      );

      if (alreadyScanned) {
        return NextResponse.json({
          success: false,
          message: `This suit was already scanned by ${department}`,
          alreadyScanned: true,
          sticker,
        });
      }

      // Update sticker
      // Set status based on department
      if (department === "Store") {
        sticker.status = "in_store";
      } else if (department === "Packing") {
        sticker.status = "packed";
      } else {
        sticker.status = "scanned";
      }
      sticker.currentDepartment = department as Department;
      sticker.departmentHistory.push({
        department: department as Department,
        scannedAt: new Date(),
        scannedBy: scannedBy || undefined,
      });

      await sticker.save();

      return NextResponse.json({
        success: true,
        message: `Suit scanned at ${department}`,
        sticker,
      });
    }

    // Just return sticker info without updating
    return NextResponse.json({
      success: true,
      sticker,
      isFinalSticker: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
