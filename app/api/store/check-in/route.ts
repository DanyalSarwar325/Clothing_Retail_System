import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { postStoreCheckInJournal } from "@/app/libs/accounting/inventoryPostingService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcodeData, scannedBy } = body;

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

    let sticker = await prisma.finalSticker.findUnique({
      where: { barcodeData },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    if (!sticker && parsedData.design && parsedData.size && parsedData.unitNumber) {
      sticker = await prisma.finalSticker.findFirst({
        where: {
          design: parsedData.design,
          size: parsedData.size,
          unitNumber: parsedData.unitNumber,
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
      });
    }

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found in database" },
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

    if (sticker.status === "in_store") {
      return NextResponse.json({
        success: false,
        message: "This item is already in store",
        alreadyInStore: true,
        sticker: formatSticker(sticker),
      });
    }

    const updatedSticker = await prisma.finalSticker.update({
      where: { id: sticker.id },
      data: {
        status: "in_store",
        currentDepartment: "Store",
        dispatchInfo: undefined,
        departmentHistory: {
          create: {
            department: "Store",
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

    // Automatically post accounting journal: Finished Goods Inventory (AS-102) Dr / WIP (AS-105) Cr
    await postStoreCheckInJournal({
      finalStickerId: updatedSticker.id,
      design: updatedSticker.design,
      suitType: updatedSticker.suitType,
      size: updatedSticker.size,
      unitNumber: updatedSticker.unitNumber,
      sellingPrice: updatedSticker.sellingPrice,
      scannedBy: scannedBy || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Suit checked in to store successfully",
      sticker: formatSticker(updatedSticker),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
