import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        departmentRates: true,
        receivingLogs: { include: { items: true } },
      },
    });

    if (!po) {
      return NextResponse.json(
        { success: false, message: "Purchase Order not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { items, cuttingPersonName, notes, receivedBy } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "No received items provided" },
        { status: 400 }
      );
    }

    const validItems = items.filter(
      (it: any) =>
        ["S", "M", "L"].includes(it.size) &&
        ["Qameez", "Shalwar", "Dupatta"].includes(it.item) &&
        typeof it.quantity === "number" &&
        it.quantity > 0
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please provide valid quantities greater than 0" },
        { status: 400 }
      );
    }

    const requestedTotals: Record<string, number> = {};
    for (const it of validItems) {
      const key = `${it.size}_${it.item}`;
      requestedTotals[key] = (requestedTotals[key] || 0) + it.quantity;
    }

    const plannedQuantities = (po.plannedQuantities as any) || {};
    const receivedQuantities = (po.receivedQuantities as any) || {};

    for (const [key, qty] of Object.entries(requestedTotals)) {
      const [size, item] = key.split("_") as ["S" | "M" | "L", "Qameez" | "Shalwar" | "Dupatta"];
      const planned = plannedQuantities?.[size]?.[item] || 0;
      const currentReceived = receivedQuantities?.[size]?.[item] || 0;
      const remainingAllowed = Math.max(0, planned - currentReceived);

      if (qty > remainingAllowed) {
        if (remainingAllowed === 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Cannot receive ${item} (${size}). All ${planned} planned pieces have already been received.`,
            },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            message: `Cannot receive ${qty} pieces of ${item} (${size}). Only ${remainingAllowed} remaining planned pieces can be received (${currentReceived}/${planned} already received).`,
          },
          { status: 400 }
        );
      }
    }

    validItems.forEach((it: any) => {
      const size = it.size as "S" | "M" | "L";
      const item = it.item as "Qameez" | "Shalwar" | "Dupatta";
      if (!receivedQuantities[size]) receivedQuantities[size] = {};
      const current = receivedQuantities[size]?.[item] || 0;
      receivedQuantities[size][item] = current + it.quantity;
    });

    const newStatus = po.status === "Open" ? "In Progress" : po.status;

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          receivedQuantities,
          status: newStatus,
          receivingLogs: {
            create: {
              receivedAt: new Date(),
              receivedBy: receivedBy || "Admin",
              cuttingPersonName: "Cutting Master",
              notes: notes || "",
              items: {
                create: validItems.map((it: any) => ({
                  size: it.size,
                  item: it.item,
                  quantity: it.quantity,
                })),
              },
            },
          },
        },
      });
    });

    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: {
        departmentRates: true,
        receivingLogs: { include: { items: true } },
      },
    });

    const formattedPo = updatedPo
      ? {
          ...updatedPo,
          _id: updatedPo.id,
          departmentRates: updatedPo.departmentRates.map((r) => ({ ...r, _id: r.id })),
          receivingLogs: updatedPo.receivingLogs.map((l) => ({
            ...l,
            _id: l.id,
            items: l.items.map((it) => ({ ...it, _id: it.id })),
          })),
        }
      : null;

    const totalReceivedInThisBatch = validItems.reduce((acc, cur) => acc + cur.quantity, 0);

    return NextResponse.json({
      success: true,
      message: `Successfully received ${totalReceivedInThisBatch} cut pieces from cutting department`,
      purchaseOrder: formattedPo,
    });
  } catch (error: any) {
    console.error("Error logging received cut items:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to log received items" },
      { status: 500 }
    );
  }
}
