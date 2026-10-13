import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { DEPARTMENTS, Department } from "@/app/libs/models/barcode";

// POST - Scan a barcode (lookup by barcode data and optionally update department)
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

    // Find barcode by its data
    const barcode = await Barcode.findOne({ barcodeData });

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found in database" },
        { status: 404 }
      );
    }

    // Update scannedAt timestamp
    barcode.scannedAt = new Date();

    // If department is provided, update current department and add to history
    if (department && DEPARTMENTS.includes(department as Department)) {
      // Initialize departmentHistory if it doesn't exist
      if (!barcode.departmentHistory) {
        barcode.departmentHistory = [];
      }

      // Check if this barcode was already scanned by this department
      const alreadyScannedByDepartment = barcode.departmentHistory.some(
        (entry: { department: string }) => entry.department === department
      );

      if (alreadyScannedByDepartment) {
        return NextResponse.json(
          {
            success: false,
            message: `This barcode has already been scanned by ${department} department`,
            alreadyScanned: true,
          },
          { status: 400 }
        );
      }

      barcode.currentDepartment = department as Department;
      
      // Add to department history
      barcode.departmentHistory.push({
        department: department as Department,
        scannedAt: new Date(),
        scannedBy: scannedBy || undefined,
      });

      // For Sewing department: if barcode was in 'generated' status, mark it as 'scanned'
      // This means the barcode received from master is now confirmed and in work
      if (department === "Sewing" && barcode.status === "generated") {
        barcode.status = "scanned";
      }
    }

    await barcode.save();

    return NextResponse.json({
      success: true,
      message: department ? `Barcode updated to ${department}` : "Barcode found",
      barcode: {
        id: barcode._id,
        design: barcode.design,
        size: barcode.size,
        item: barcode.item,
        unitNumber: barcode.unitNumber,
        status: barcode.status,
        currentDepartment: barcode.currentDepartment,
        departmentHistory: barcode.departmentHistory,
        createdAt: barcode.createdAt,
        scannedAt: barcode.scannedAt,
        soldAt: barcode.soldAt,
      },
    });
  } catch (error: any) {
    console.error("Error scanning barcode:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to scan barcode" },
      { status: 500 }
    );
  }
}
