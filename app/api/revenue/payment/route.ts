import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stickerId, amountReceived, receivedBy, notes } = body;

    if (!stickerId) {
      return NextResponse.json(
        { success: false, message: "Sticker ID is required" },
        { status: 400 }
      );
    }

    const sticker = await prisma.finalSticker.findUnique({
      where: { id: stickerId },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
    });

    if (!sticker) {
      return NextResponse.json(
        { success: false, message: "Sticker not found" },
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

    if (sticker.status !== "dispatched") {
      return NextResponse.json({
        success: false,
        message: `Cannot receive payment: Item status is "${sticker.status}". Only dispatched items can receive payment.`,
        sticker: formatSticker(sticker),
      });
    }

    const amount = amountReceived || sticker.sellingPrice;

    const paymentInfo = {
      isPaid: true,
      amountReceived: amount,
      paidAt: new Date().toISOString(),
      receivedBy: receivedBy || "Admin",
      notes: notes || undefined,
    };

    const updatedSticker = await prisma.finalSticker.update({
      where: { id: sticker.id },
      data: {
        status: "delivered",
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
      message: `Payment received: PKR ${amount.toLocaleString()} for ${updatedSticker.design} - ${updatedSticker.suitType} - Unit #${updatedSticker.unitNumber}`,
      sticker: formatSticker(updatedSticker),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
