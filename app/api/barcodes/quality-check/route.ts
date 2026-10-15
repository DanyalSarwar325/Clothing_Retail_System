import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

const VALID_DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
] as const;

// POST - Update quality check status for a barcode
export async function POST(request: NextRequest) {
  try {
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

    if (isDamaged && (!notes || !notes.trim())) {
      return NextResponse.json(
        { success: false, message: "Please provide remarks explaining why the item was marked damaged" },
        { status: 400 }
      );
    }

    // Find barcode
    const barcode = await prisma.barcode.findUnique({
      where: { id: barcodeId },
      include: {
        departmentHistory: true,
      },
    });

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    const finalStatus = status;
    const now = new Date();

    // Execute quality check update in an atomic transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create audit log for quality inspection (permits multiple inspections: OK -> Defective -> OK)
      await tx.qualityCheckLog.create({
        data: {
          barcodeId: barcode.id,
          status: finalStatus,
          checkedBy,
          department: isDamaged && department ? department : null,
          responsiblePerson: isDamaged && responsiblePerson ? responsiblePerson : null,
          notes: notes?.trim() || null,
          checkedAt: now,
        },
      });

      // 2. Auto-record Overlock and Clipping when Quality approves the piece
      if (finalStatus === "quality_ok") {
        const hasOverlock = barcode.departmentHistory.some((h) => h.department === "Overlock");
        if (!hasOverlock) {
          await tx.barcodeScan.create({
            data: {
              barcodeId: barcode.id,
              department: "Overlock",
              scannedAt: now,
              scannedBy: "Overlock",
            },
          });
        }

        const hasClipping = barcode.departmentHistory.some((h) => h.department === "Clipping");
        if (!hasClipping) {
          await tx.barcodeScan.create({
            data: {
              barcodeId: barcode.id,
              department: "Clipping",
              scannedAt: now,
              scannedBy: "Clipping",
            },
          });
        }

        // Clean up any active defect record if previously defective
        await tx.barcodeDefect.deleteMany({
          where: { barcodeId: barcode.id },
        });
      } else if (isDamaged) {
        // Record / update active defect
        await tx.barcodeDefect.upsert({
          where: { barcodeId: barcode.id },
          create: {
            barcodeId: barcode.id,
            department: department || "Quality",
            markedBy: checkedBy,
            reason: "Quality issue",
            notes: notes?.trim() || null,
            markedAt: now,
          },
          update: {
            department: department || "Quality",
            markedBy: checkedBy,
            reason: "Quality issue",
            notes: notes?.trim() || null,
            markedAt: now,
          },
        });
      }

      // 3. Record Quality scan in history
      await tx.barcodeScan.create({
        data: {
          barcodeId: barcode.id,
          department: "Quality",
          scannedAt: now,
          scannedBy: checkedBy,
        },
      });

      // 4. Update barcode master status and current department
      await tx.barcode.update({
        where: { id: barcode.id },
        data: {
          status: finalStatus,
          currentDepartment: "Quality",
          scannedAt: now,
        },
      });
    });

    const qualityCheckInfo = {
      checkedAt: now,
      checkedBy,
      status: finalStatus,
      ...(isDamaged && department ? { department } : {}),
      ...(isDamaged && responsiblePerson ? { responsiblePerson } : {}),
      notes: notes?.trim() || undefined,
    };

    return NextResponse.json({
      success: true,
      message: status === "quality_ok" ? "Product marked as Quality OK ✓" : "Product marked as Damaged",
      barcode: {
        id: barcode.id,
        _id: barcode.id,
        design: barcode.design,
        size: barcode.size,
        suitType: barcode.suitType,
        item: barcode.item,
        unitNumber: barcode.unitNumber,
        status: finalStatus,
        currentDepartment: "Quality",
        qualityCheckInfo,
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
