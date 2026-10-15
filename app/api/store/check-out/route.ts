import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      barcodeData,
      dispatchedBy,
      customerName,
      customerPhone,
      customerAddress,
      checkoutType,
      remarks,
    } = body;

    if (!barcodeData) {
      return NextResponse.json(
        { success: false, message: "Barcode data is required" },
        { status: 400 }
      );
    }

    if (checkoutType && !["WholeSale", "Retail", "Cmd"].includes(checkoutType)) {
      return NextResponse.json(
        { success: false, message: "Invalid checkout type. Allowed: WholeSale, Retail, Cmd." },
        { status: 400 }
      );
    }

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(barcodeData);
    } catch {
      parsedData = null;
    }

    let sticker = null;

    if (parsedData && parsedData.type === "final") {
      sticker = await prisma.finalSticker.findUnique({
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
    } else {
      sticker = await prisma.finalSticker.findFirst({
        where: {
          OR: [
            { barcodeData },
            { id: barcodeData },
          ],
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

    if (sticker.status !== "in_store") {
      return NextResponse.json({
        success: false,
        message: `Cannot checkout: Item status is "${sticker.status}". Only items in store can be checked out.`,
        sticker: formatSticker(sticker),
      });
    }

    const dispatchInfo = {
      dispatchedAt: new Date().toISOString(),
      dispatchedBy: dispatchedBy || "Store",
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      customerAddress: customerAddress || undefined,
      checkoutType: checkoutType || "Retail",
      remarks: remarks?.trim() || undefined,
    };

    const paymentInfo = {
      isPaid: false,
      amountReceived: 0,
      notes: remarks?.trim() || undefined,
    };

    const updatedSticker = await prisma.finalSticker.update({
      where: { id: sticker.id },
      data: {
        status: "dispatched",
        dispatchInfo,
        paymentInfo,
      },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Item checked out (${dispatchInfo.checkoutType}): ${updatedSticker.design} - ${updatedSticker.suitType} - Unit #${updatedSticker.unitNumber}`,
      sticker: formatSticker(updatedSticker),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
