import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";

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

    // Group by unit
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

    return NextResponse.json({
      success: true,
      design: decodedDesign,
      units: Object.values(units),
      totalItems: barcodes.length,
    });
  } catch (error: any) {
    console.error("Design details error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch design details" },
      { status: 500 }
    );
  }
}
