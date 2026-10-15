import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const design = searchParams.get("design");

    const where: any = {};
    if (status) {
      where.status = status;
    } else if (design) {
      where.OR = [
        { status: { in: ["in_store", "packed", "dispatched", "delivered"] } },
        { currentDepartment: "Store" },
      ];
    }

    if (design) where.design = design;

    let itemsRaw;
    if (!status && !design) {
      itemsRaw = await prisma.finalSticker.findMany({
        where: {
          OR: [
            { status: { in: ["in_store", "packed", "dispatched", "delivered"] } },
            { currentDepartment: "Store" },
          ],
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
        orderBy: { updatedAt: "desc" },
      });
    } else {
      itemsRaw = await prisma.finalSticker.findMany({
        where,
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    const items = itemsRaw.map((s) => ({
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

    const inStoreItems = items.filter((i) =>
      i.status === "in_store" ||
      i.status === "packed" ||
      (i.currentDepartment === "Store" && !["dispatched", "delivered"].includes(i.status))
    );
    const dispatchedItems = items.filter((i) => i.status === "dispatched");
    const deliveredItems = items.filter((i) => i.status === "delivered");

    const totalInStore = inStoreItems.length;
    const totalDispatched = dispatchedItems.length;
    const totalDelivered = deliveredItems.length;

    const totalCreditSale = dispatchedItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
    const totalRevenue = deliveredItems.reduce(
      (sum, item) => sum + ((item.paymentInfo as any)?.amountReceived || 0),
      0
    );
    const totalPending = totalCreditSale;

    const pendingFromDelivered = deliveredItems.reduce((sum, item) => {
      const received = (item.paymentInfo as any)?.amountReceived || 0;
      const price = item.sellingPrice || 0;
      return sum + (price - received);
    }, 0);

    const inventoryValue = inStoreItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalInStore,
        totalDispatched,
        totalDelivered,
        totalItems: totalInStore + totalDispatched + totalDelivered,
        inventoryValue,
        totalCreditSale,
        totalRevenue,
        totalPending: totalCreditSale + pendingFromDelivered,
        pendingFromDelivered,
      },
      items: {
        inStore: inStoreItems,
        dispatched: dispatchedItems,
        delivered: deliveredItems,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
