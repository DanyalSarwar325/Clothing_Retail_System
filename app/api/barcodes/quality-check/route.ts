import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { DEPARTMENTS, Department } from "@/app/libs/models/barcode";

const QUALITY_DEPARTMENTS = ["Sewing", "Cutting"] as const;

// POST - Update quality check status for a barcode
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeId, checkedBy, status, department, notes } = body;

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

    if (!status || !["quality_ok", "wasted"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Valid status is required (quality_ok or wasted)" },
        { status: 400 }
      );
    }

    // Department is only required for wasted status
    if (status === "wasted" && (!department || !QUALITY_DEPARTMENTS.includes(department))) {
      return NextResponse.json(
        { success: false, message: "Valid department is required for wasted items (Sewing or Cutting)" },
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

    // Check if already quality checked or wasted
    if (barcode.status === "quality_ok" || barcode.status === "wasted") {
      return NextResponse.json(
        { success: false, message: "This barcode has already been quality checked" },
        { status: 400 }
      );
    }

    // Check if already marked as defective
    if (barcode.status === "defective" || barcode.status === "damaged") {
      return NextResponse.json(
        { success: false, message: "This barcode is already marked as defective/damaged" },
        { status: 400 }
      );
    }

    // Update barcode status and qualityCheckInfo
    barcode.status = status;
    barcode.qualityCheckInfo = {
      checkedAt: new Date(),
      checkedBy,
      status,
      ...(status === "wasted" && department ? { department } : {}),
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
        : "Product marked as Wasted",
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
