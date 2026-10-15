import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// Helper to generate PO Number (e.g. PO-2026-0001)
async function generatePONumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;

  const latestPO = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });

  let nextSequence = 1;
  if (latestPO && latestPO.poNumber) {
    const parts = latestPO.poNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

// GET - List all purchase orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { design: { contains: search, mode: "insensitive" } },
      ];
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        departmentRates: true,
        receivingLogs: {
          include: { items: true },
        },
      },
    });

    const formatted = pos.map((po) => {
      let totalPlanned = 0;
      let totalReceived = 0;
      let totalBarcoded = 0;

      const SIZES = ["S", "M", "L"] as const;
      const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

      const plannedObj = (po.plannedQuantities as any) || {};
      const receivedObj = (po.receivedQuantities as any) || {};
      const barcodedObj = (po.barcodedQuantities as any) || {};

      for (const size of SIZES) {
        for (const item of ITEMS) {
          totalPlanned += plannedObj[size]?.[item] || 0;
          totalReceived += receivedObj[size]?.[item] || 0;
          totalBarcoded += barcodedObj[size]?.[item] || 0;
        }
      }

      return {
        ...po,
        _id: po.id,
        totalPlanned,
        totalReceived,
        totalBarcoded,
        availableToBarcode: Math.max(0, totalReceived - totalBarcoded),
      };
    });

    return NextResponse.json({
      success: true,
      count: formatted.length,
      purchaseOrders: formatted,
    });
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

// POST - Create a new Purchase Order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { design, plannedQuantities, departmentRates, notes, poNumber: userPoNumber } = body;

    if (!design || !design.trim()) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    if (!plannedQuantities) {
      return NextResponse.json(
        { success: false, message: "Planned quantities are required" },
        { status: 400 }
      );
    }

    const SIZES = ["S", "M", "L"] as const;
    const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;
    let totalPieces = 0;
    for (const size of SIZES) {
      for (const item of ITEMS) {
        totalPieces += plannedQuantities[size]?.[item] || 0;
      }
    }

    if (totalPieces === 0) {
      return NextResponse.json(
        { success: false, message: "Please plan at least one piece" },
        { status: 400 }
      );
    }

    const poNumber = userPoNumber?.trim()
      ? userPoNumber.trim().toUpperCase()
      : await generatePONumber();

    const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `PO Number ${poNumber} already exists` },
        { status: 400 }
      );
    }

    const newPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        design: design.trim(),
        status: "Open",
        plannedQuantities,
        receivedQuantities: {
          S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
          M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
          L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        },
        barcodedQuantities: {
          S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
          M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
          L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        },
        notes: notes || "",
        departmentRates:
          departmentRates && Array.isArray(departmentRates)
            ? {
                create: departmentRates.map((r: any) => ({
                  department: r.department,
                  ratePerPiece: Number(r.ratePerPiece) || 0,
                  item: r.item || null,
                })),
              }
            : undefined,
      },
      include: {
        departmentRates: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${poNumber} created successfully`,
      purchaseOrder: {
        ...newPO,
        _id: newPO.id,
      },
    });
  } catch (error: any) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
