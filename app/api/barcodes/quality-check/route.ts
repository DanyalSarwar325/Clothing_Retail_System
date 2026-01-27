import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { DEPARTMENTS, Department } from "@/app/libs/models/barcode";

// All departments can be responsible for damage
const VALID_DEPARTMENTS = ["Cutting", "Sewing", "Quality", "Handmade", "Adda Work", "Patching", "Press", "Packing", "Store"] as const;

// POST - Update quality check status for a barcode
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeId, checkedBy, status, department, responsiblePerson, notes } = body;

    if (!barcodeId) {
      return NextResponse.json(
        { success: false, message: "Barcode ID is required" },
        { status: 400 }
      );
    }

    if (!checkedBy) {
      return NextResponse.json(
        { success: false, message: "Checker name (checkedBy) is required" },
        { status: 400 }
      );
    }

    // Only accept quality_ok or damaged
    if (!status || !["quality_ok", "damaged"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Valid status is required (quality_ok or damaged)" },
        { status: 400 }
      );
    }

    // Department is required for damaged status
    const isDamaged = status === "damaged";
    if (isDamaged && (!department || !VALID_DEPARTMENTS.includes(department))) {
      return NextResponse.json(
        { success: false, message: "Valid department is required for damaged items" },
        { status: 400 }
      );
    }

    // Find the barcode
    const barcode = await Barcode.findById(barcodeId);

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    // Check if already quality checked or damaged
    if (barcode.status === "quality_ok" || barcode.status === "damaged") {
      return NextResponse.json(
        { success: false, message: "This barcode has already been quality checked" },
        { status: 400 }
      );
    }

    // Check if already marked as defective
    if (barcode.status === "defective") {
      return NextResponse.json(
        { success: false, message: "This barcode is already marked as defective" },
        { status: 400 }
      );
    }

    // Set final status
    const finalStatus = status;

    // Update barcode status and qualityCheckInfo
    barcode.status = finalStatus;
    barcode.qualityCheckInfo = {
      checkedAt: new Date(),
      checkedBy,
      status: finalStatus,
      ...(isDamaged && department ? { department } : {}),
      ...(isDamaged && responsiblePerson ? { responsiblePerson } : {}),
      notes: notes || undefined,
    };

    // Also add to department history
    barcode.departmentHistory.push({
      department: "Quality" as Department,
      scannedAt: new Date(),
      scannedBy: checkedBy,
    });
    barcode.currentDepartment = "Quality";
    barcode.scannedAt = new Date();

    await barcode.save();

    return NextResponse.json({
      success: true,
      message: status === "quality_ok" 
        ? "Product marked as Quality OK" 
        : "Product marked as Damaged",
      barcode: {
        id: barcode._id,
        design: barcode.design,
        size: barcode.size,
        item: barcode.item,
        unitNumber: barcode.unitNumber,
        status: barcode.status,
        currentDepartment: barcode.currentDepartment,
        qualityCheckInfo: barcode.qualityCheckInfo,
      },
    });
  } catch (error: any) {
    console.error("Quality check error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update quality status" },
      { status: 500 }
    );
  }
}
