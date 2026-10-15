import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stickerId, barcodeData, returnedBy, remarks } = body;

    if (!stickerId && !barcodeData) {
      return NextResponse.json(
        { success: false, message: "Sticker ID or barcode data is required" },
        { status: 400 }
      );
    }

    let sticker = null;

    if (stickerId) {
      sticker = await prisma.finalSticker.findUnique({
        where: { id: stickerId },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
      });
    } else if (barcodeData) {
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(barcodeData);
      } catch {
        parsedData = null;
      }

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
    }

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Final sticker not found" },
        { status: 404 }
      );
    }

    const prevStatus = sticker.status;
    const paymentInfoObj = (sticker.paymentInfo as any) || {};
    const previouslyReceived = paymentInfoObj.amountReceived || 0;

    const returnInfo = {
      returnedAt: new Date().toISOString(),
      returnedBy: returnedBy || "Store",
      remarks: remarks?.trim() || "Item returned to Store inventory",
      previousStatus: prevStatus,
    };

    const paymentInfo = {
      isPaid: false,
      amountReceived: 0,
      notes: previouslyReceived > 0
        ? `Returned on ${new Date().toLocaleDateString()}. Reversed revenue of Rs. ${previouslyReceived}. Notes: ${remarks || ""}`
        : `Returned to store. Notes: ${remarks || ""}`,
    };

    const updatedSticker = await prisma.finalSticker.update({
      where: { id: sticker.id },
      data: {
        returnInfo,
        paymentInfo,
        dispatchInfo: undefined,
        status: "in_store",
        currentDepartment: "Store",
        departmentHistory: {
          create: {
            department: "Store",
            scannedAt: new Date(),
            scannedBy: `${returnedBy || "Store"} (Return to Inventory)`,
          },
        },
      },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    const formatSticker = (s: typeof updatedSticker) => ({
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

    return NextResponse.json({
      success: true,
      message: `Item returned to Store inventory: ${updatedSticker.design} - ${updatedSticker.suitType} - Unit #${updatedSticker.unitNumber}. Inventory increased by 1 and revenue subtracted.`,
      reversedRevenue: previouslyReceived,
      sticker: formatSticker(updatedSticker),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
