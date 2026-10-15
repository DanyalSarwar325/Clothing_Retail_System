import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};
    if (status) {
      if (status === "returned") {
        where.returnInfo = { not: null };
      } else {
        where.status = status;
      }
    }

    if (search) {
      where.OR = [
        { design: { contains: search, mode: "insensitive" } },
      ];
    }

    const rawItems = await prisma.finalSticker.findMany({
      where,
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });

    const items = rawItems.map((s) => ({
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
    }));

    const allStickers = await prisma.finalSticker.findMany({
      where: {
        status: { in: ["in_store", "packed", "dispatched", "delivered", "returned"] },
      },
      select: {
        status: true,
        sellingPrice: true,
        paymentInfo: true,
        returnInfo: true,
      },
    });

    const inStoreList = allStickers.filter(
      (s) => s.status === "in_store" || s.status === "packed"
    );
    const dispatchedList = allStickers.filter((s) => s.status === "dispatched");
    const deliveredList = allStickers.filter((s) => s.status === "delivered");
    const returnedList = allStickers.filter((s) => !!(s.returnInfo as any)?.returnedAt);

    const totalInStore = inStoreList.length;
    const totalDispatched = dispatchedList.length;
    const totalDelivered = deliveredList.length;
    const totalReturned = returnedList.length;

    const inventoryValue = inStoreList.reduce((acc, s) => acc + (s.sellingPrice || 0), 0);
    const dispatchedValue = dispatchedList.reduce((acc, s) => acc + (s.sellingPrice || 0), 0);
    const totalRevenue = deliveredList.reduce(
      (acc, s) => acc + ((s.paymentInfo as any)?.amountReceived || 0),
      0
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalInStore,
        totalDispatched,
        totalDelivered,
        totalReturned,
        inventoryValue,
        dispatchedValue,
        totalRevenue,
      },
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
