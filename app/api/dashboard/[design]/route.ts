import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ design: string }> }
) {
  try {
    const { design } = await params;
    const decodedDesign = decodeURIComponent(design);

    const barcodes = await prisma.barcode.findMany({
      where: { design: decodedDesign },
      include: {
        departmentHistory: { orderBy: { scannedAt: "asc" } },
      },
      orderBy: [{ size: "asc" }, { item: "asc" }, { unitNumber: "asc" }],
    });

    const finalStickers = await prisma.finalSticker.findMany({
      where: { design: decodedDesign },
      include: {
        departmentHistory: { orderBy: { scannedAt: "asc" } },
      },
      orderBy: [{ size: "asc" }, { unitNumber: "asc" }],
    });

    const units: Record<string, any> = {};

    barcodes.forEach((barcode) => {
      const unitKey = `${barcode.size}-${barcode.unitNumber}`;
      if (!units[unitKey]) {
        units[unitKey] = {
          size: barcode.size,
          unitNumber: barcode.unitNumber,
          items: [],
        };
      }
      units[unitKey].items.push({
        id: barcode.id,
        _id: barcode.id,
        item: barcode.item,
        currentDepartment: barcode.currentDepartment,
        status: barcode.status,
        departmentHistory: barcode.departmentHistory.map((h) => ({
          _id: h.id,
          department: h.department,
          scannedAt: h.scannedAt,
          scannedBy: h.scannedBy,
        })),
        createdAt: barcode.createdAt,
        scannedAt: barcode.scannedAt,
        sequenceNumber: barcode.sequenceNumber,
        totalUnitsInBatch: barcode.totalUnitsInBatch,
      });
    });

    const finalStickerCards = finalStickers.map((sticker) => ({
      id: sticker.id,
      _id: sticker.id,
      size: sticker.size,
      unitNumber: sticker.unitNumber,
      suitType: sticker.suitType,
      sellingPrice: sticker.sellingPrice,
      currentDepartment: sticker.currentDepartment,
      status: sticker.status,
      departmentHistory: sticker.departmentHistory.map((h) => ({
        _id: h.id,
        department: h.department,
        scannedAt: h.scannedAt,
        scannedBy: h.scannedBy,
      })),
      createdAt: sticker.createdAt,
    }));

    return NextResponse.json({
      success: true,
      design: decodedDesign,
      units: Object.values(units),
      finalStickers: finalStickerCards,
      totalItems: barcodes.length,
      totalFinalStickers: finalStickers.length,
    });
  } catch (error: any) {
    console.error("Design details error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch design details" },
      { status: 500 }
    );
  }
}
