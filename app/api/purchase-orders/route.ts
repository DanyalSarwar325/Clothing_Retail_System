import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import PurchaseOrder from "@/app/libs/models/purchaseOrder";

// Helper to generate PO Number (e.g. PO-2026-0001)
async function generatePONumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;
  
  // Find highest existing PO number for current year
  const latestPO = await PurchaseOrder.findOne({
    poNumber: { $regex: `^${prefix}` },
  })
    .sort({ poNumber: -1 })
    .select("poNumber");

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
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");

    const query: any = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { poNumber: { $regex: search, $options: "i" } },
        { design: { $regex: search, $options: "i" } },
      ];
    }

    const pos = await PurchaseOrder.find(query).sort({ createdAt: -1 });

    // Format with computed totals
    const formatted = pos.map((po) => {
      let totalPlanned = 0;
      let totalReceived = 0;
      let totalBarcoded = 0;

      const SIZES = ["S", "M", "L"] as const;
      const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

      for (const size of SIZES) {
        for (const item of ITEMS) {
          totalPlanned += po.plannedQuantities?.[size]?.[item] || 0;
          totalReceived += po.receivedQuantities?.[size]?.[item] || 0;
          totalBarcoded += po.barcodedQuantities?.[size]?.[item] || 0;
        }
      }

      return {
        ...po.toObject(),
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
    await DbConnect();

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

    // Verify there is at least one piece planned
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

    // Check if PO number already exists
    const existing = await PurchaseOrder.findOne({ poNumber });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `PO Number ${poNumber} already exists` },
        { status: 400 }
      );
    }

    const newPO = await PurchaseOrder.create({
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
      departmentRates: departmentRates || [],
      receivingLogs: [],
      notes: notes || "",
    });

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${poNumber} created successfully`,
      purchaseOrder: newPO,
    });
  } catch (error: any) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
