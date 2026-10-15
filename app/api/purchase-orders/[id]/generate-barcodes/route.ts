import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ITEM_TO_SUIT_TYPE: Record<string, "1pc" | "2pc" | "3pc"> = {
  Qameez: "1pc",
  Shalwar: "2pc",
  Dupatta: "3pc",
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        departmentRates: true,
        receivingLogs: {
          include: { items: true },
          orderBy: { receivedAt: "desc" },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { success: false, message: "Purchase Order not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    let requestItems: Array<{ size: "S" | "M" | "L"; item: "Qameez" | "Shalwar" | "Dupatta"; quantity: number }> = [];

    if (body.size && body.item && typeof body.quantity === "number") {
      requestItems = [{ size: body.size, item: body.item, quantity: body.quantity }];
    } else if (Array.isArray(body.items)) {
      requestItems = body.items;
    } else {
      return NextResponse.json(
        { success: false, message: "Please specify size, item, and quantity" },
        { status: 400 }
      );
    }

    requestItems = requestItems.filter(
      (it) =>
        ["S", "M", "L"].includes(it.size) &&
        ["Qameez", "Shalwar", "Dupatta"].includes(it.item) &&
        it.quantity > 0
    );

    if (requestItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please enter a quantity greater than 0" },
        { status: 400 }
      );
    }

    const receivedQuantities = (po.receivedQuantities as any) || {};
    const barcodedQuantities = (po.barcodedQuantities as any) || {};
    const plannedQuantities = (po.plannedQuantities as any) || {};

    for (const req of requestItems) {
      const received = receivedQuantities[req.size]?.[req.item] || 0;
      const alreadyBarcoded = barcodedQuantities[req.size]?.[req.item] || 0;
      const available = Math.max(0, received - alreadyBarcoded);

      if (req.quantity > available) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot generate ${req.quantity} pieces of ${req.item} (Size ${req.size}). Only ${available} pieces received from cutting master are available (Received: ${received}, Already Barcoded: ${alreadyBarcoded}).`,
          },
          { status: 400 }
        );
      }
    }

    const rates = po.departmentRates || [];
    const barcodesToInsert: any[] = [];

    const cuttingPerson = po.receivingLogs.find((l) => l.cuttingPersonName)?.cuttingPersonName || "Cutting Master";

    for (const req of requestItems) {
      const suitType = ITEM_TO_SUIT_TYPE[req.item] || "1pc";

      const existingItemBarcodesCount = await prisma.barcode.count({
        where: {
          design: po.design,
          item: req.item,
        },
      });

      const existingSizeUnitCount = await prisma.barcode.count({
        where: {
          design: po.design,
          size: req.size,
          item: req.item,
        },
      });

      const totalPlannedForItem =
        (plannedQuantities.S?.[req.item] || 0) +
        (plannedQuantities.M?.[req.item] || 0) +
        (plannedQuantities.L?.[req.item] || 0);

      const totalItemDisplay = totalPlannedForItem > 0 ? totalPlannedForItem : existingItemBarcodesCount + req.quantity;

      for (let i = 1; i <= req.quantity; i++) {
        const itemSequence = existingItemBarcodesCount + i;
        const unitNumber = existingSizeUnitCount + i;

        const payload = {
          design: po.design,
          size: req.size,
          item: req.item,
          seq: itemSequence,
          totalItems: totalItemDisplay,
          po: po.poNumber,
        };
        const barcodeDataStr = JSON.stringify(payload);

        barcodesToInsert.push({
          design: po.design,
          size: req.size,
          suitType: suitType,
          item: req.item,
          unitNumber: unitNumber,
          sequenceNumber: itemSequence,
          totalUnitsInBatch: totalItemDisplay,
          barcodeData: barcodeDataStr,
          status: "generated",
          currentDepartment: "Cutting",
          poId: po.id,
          poNumber: po.poNumber,
          cuttingPerson,
        });
      }

      if (!barcodedQuantities[req.size]) barcodedQuantities[req.size] = {};
      const currentBarcoded = barcodedQuantities[req.size]?.[req.item] || 0;
      barcodedQuantities[req.size][req.item] = currentBarcoded + req.quantity;
    }

    const SIZES = ["S", "M", "L"] as const;
    const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

    let allPlannedMet = true;
    let anyPlanned = false;
    for (const size of SIZES) {
      for (const item of ITEMS) {
        const planned = plannedQuantities[size]?.[item] || 0;
        const barcoded = barcodedQuantities[size]?.[item] || 0;
        if (planned > 0) {
          anyPlanned = true;
          if (barcoded < planned) {
            allPlannedMet = false;
          }
        }
      }
    }

    const newStatus = anyPlanned && allPlannedMet ? "Completed" : "In Progress";

    // Perform database operations in a transaction
    const createdBarcodes = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const b of barcodesToInsert) {
        const cuttingRateObj = rates.find((r) => r.department === "Cutting" && r.item === b.item);
        const cuttingRate = cuttingRateObj?.ratePerPiece || 0;
        const isCuttingAlreadyPaid = po.receivingLogs.some((l) =>
          l.items.some((it) => it.item === b.item && it.size === b.size && it.isPaid)
        );

        const newBarcode = await tx.barcode.create({
          data: {
            design: b.design,
            size: b.size,
            suitType: b.suitType,
            item: b.item,
            unitNumber: b.unitNumber,
            sequenceNumber: b.sequenceNumber,
            totalUnitsInBatch: b.totalUnitsInBatch,
            barcodeData: b.barcodeData,
            status: b.status,
            currentDepartment: b.currentDepartment,
            poId: b.poId,
            poNumber: b.poNumber,
            departmentHistory: {
              create: [
                {
                  department: "Cutting",
                  scannedAt: new Date(),
                  scannedBy: b.cuttingPerson,
                },
                {
                  department: "Admin",
                  scannedAt: new Date(),
                  scannedBy: "Admin",
                },
              ],
            },
            departmentRates: {
              create: rates.map((r) => ({
                department: r.department,
                ratePerPiece: r.ratePerPiece,
                item: r.item,
              })),
            },
            paidDepartments: isCuttingAlreadyPaid
              ? {
                  create: [
                    {
                      department: "Cutting",
                      amount: cuttingRate,
                      paidBy: "Admin",
                      paidAt: new Date(),
                    },
                  ],
                }
              : undefined,
          },
        });
        created.push({ ...newBarcode, _id: newBarcode.id });
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          barcodedQuantities,
          status: newStatus,
        },
      });

      return created;
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

    return NextResponse.json({
      success: true,
      message: `${createdBarcodes.length} barcodes generated successfully for PO ${po.poNumber}`,
      count: createdBarcodes.length,
      barcodes: createdBarcodes,
      purchaseOrder: formattedPo,
    });
  } catch (error: any) {
    console.error("Error generating barcodes from PO:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate barcodes" },
      { status: 500 }
    );
  }
}
