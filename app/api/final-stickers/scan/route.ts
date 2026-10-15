import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Handmade",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
  "Adda Work",
  "Quality",
  "Packing",
  "Store",
] as const;

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

    let parsedData: any;
    try {
      parsedData = JSON.parse(barcodeData);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid barcode format" },
        { status: 400 }
      );
    }

    if (parsedData.type !== "final") {
      return NextResponse.json(
        { success: false, message: "This is not a final sticker barcode", isFinalSticker: false },
        { status: 400 }
      );
    }

    const sticker = await prisma.finalSticker.findUnique({
      where: { barcodeData },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found" },
        { status: 404 }
      );
    }

    const formatSticker = (s: typeof sticker) => ({
      ...s,
      _id: s.id,
      departmentHistory: s.departmentHistory.map((h) => ({
        _id: h.id,
        department: h.department,
        scannedAt: h.scannedAt,
        scannedBy: h.scannedBy,
      })),
      departmentRates: s.departmentRates.map((r) => ({
        _id: r.id,
        department: r.department,
        ratePerPiece: r.ratePerPiece,
      })),
      paidDepartments: s.paidDepartments.map((p) => ({
        _id: p.id,
        department: p.department,
        amount: p.amount,
        paidAt: p.paidAt,
        paidBy: p.paidBy,
      })),
    });

    if (department) {
      if (!DEPARTMENTS.includes(department)) {
        return NextResponse.json(
          { success: false, message: "Invalid department" },
          { status: 400 }
        );
      }

      const alreadyScanned = sticker.departmentHistory.some(
        (scan) => scan.department === department
      );

      if (alreadyScanned) {
        return NextResponse.json({
          success: false,
          message: `This suit was already scanned by ${department}`,
          alreadyScanned: true,
          sticker: formatSticker(sticker),
        });
      }

      let newStatus = "scanned";
      if (department === "Store") {
        newStatus = "in_store";
      } else if (department === "Packing") {
        newStatus = "packed";
      }

      const updatedSticker = await prisma.finalSticker.update({
        where: { id: sticker.id },
        data: {
          status: newStatus,
          currentDepartment: department,
          departmentHistory: {
            create: {
              department,
              scannedAt: new Date(),
              scannedBy: scannedBy || undefined,
            },
          },
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Suit scanned at ${department}`,
        sticker: formatSticker(updatedSticker),
      });
    }

    return NextResponse.json({
      success: true,
      sticker: formatSticker(sticker),
      isFinalSticker: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
