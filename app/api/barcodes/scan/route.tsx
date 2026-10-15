import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
export const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
  "Packing",
  "Store",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// POST - Scan a barcode (lookup by barcode data and optionally update department)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcodeData, department, scannedBy } = body;

    if (!barcodeData) {
      return NextResponse.json(
        { success: false, message: "Barcode data is required" },
        { status: 400 }
      );
    }

    // Find barcode by its unique barcodeData
    const barcode = await prisma.barcode.findUnique({
      where: { barcodeData },
      include: {
        departmentHistory: {
          orderBy: { scannedAt: "asc" },
        },
      },
    });

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found in database" },
        { status: 404 }
      );
    }

    let updatedBarcode: any = barcode;

    // If department is provided, update current department and add to history atomically
    if (department && DEPARTMENTS.includes(department as Department)) {
      // Check if this barcode was already scanned by this department
      // NOTE: Quality department is exempted so quality inspectors can re-scan and inspect freely
      const alreadyScannedByDepartment = barcode.departmentHistory.some(
        (entry) => entry.department === department
      );

      if (department !== "Quality" && alreadyScannedByDepartment) {
        return NextResponse.json(
          {
            success: false,
            message: `This barcode has already been scanned by ${department} department`,
            alreadyScanned: true,
          },
          { status: 400 }
        );
      }

      // Determine new status (For Sewing: if 'generated', mark it as 'scanned')
      let newStatus = barcode.status;
      if (department === "Sewing" && barcode.status === "generated") {
        newStatus = "scanned";
      }

      // Execute scan insert and status update in an atomic transaction
      await prisma.$transaction(async (tx) => {
        // Record scan event
        await tx.barcodeScan.create({
          data: {
            barcodeId: barcode.id,
            department,
            scannedBy: scannedBy || null,
            scannedAt: new Date(),
          },
        });

        // Update barcode
        updatedBarcode = await tx.barcode.update({
          where: { id: barcode.id },
          data: {
            currentDepartment: department,
            status: newStatus,
            scannedAt: new Date(),
          },
          include: {
            departmentHistory: {
              orderBy: { scannedAt: "asc" },
            },
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      message: department ? `Barcode updated to ${department}` : "Barcode found",
      barcode: {
        id: updatedBarcode.id,
        _id: updatedBarcode.id,
        barcodeData: updatedBarcode.barcodeData,
        design: updatedBarcode.design,
        size: updatedBarcode.size,
        suitType: updatedBarcode.suitType || "3pc",
        item: updatedBarcode.item,
        unitNumber: updatedBarcode.unitNumber,
        status: updatedBarcode.status,
        currentDepartment: updatedBarcode.currentDepartment,
        departmentHistory: updatedBarcode.departmentHistory.map((h: any) => ({
          department: h.department,
          scannedAt: h.scannedAt,
          scannedBy: h.scannedBy,
        })),
        createdAt: updatedBarcode.createdAt,
        scannedAt: updatedBarcode.scannedAt,
        soldAt: updatedBarcode.soldAt,
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
