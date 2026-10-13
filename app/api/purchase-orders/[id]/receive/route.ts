import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import PurchaseOrder from "@/app/libs/models/purchaseOrder";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await DbConnect();
    const { id } = await params;

    const po = await PurchaseOrder.findById(id);
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

    // Filter valid positive items
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

    // Aggregate requested quantities to handle potential duplicate items in the payload
    const requestedTotals: Record<string, number> = {};
    for (const it of validItems) {
      const key = `${it.size}_${it.item}`;
      requestedTotals[key] = (requestedTotals[key] || 0) + it.quantity;
    }

    // STRICT VALIDATION: Ensure received pieces do not exceed remaining planned pieces
    for (const [key, qty] of Object.entries(requestedTotals)) {
      const [size, item] = key.split("_") as ["S" | "M" | "L", "Qameez" | "Shalwar" | "Dupatta"];
      const planned = po.plannedQuantities?.[size]?.[item] || 0;
      const currentReceived = po.receivedQuantities?.[size]?.[item] || 0;
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

    // Increment received quantities on the PO
    validItems.forEach((it: any) => {
      const size = it.size as "S" | "M" | "L";
      const item = it.item as "Qameez" | "Shalwar" | "Dupatta";
      const current = po.receivedQuantities[size]?.[item] || 0;
      po.receivedQuantities[size][item] = current + it.quantity;
    });

    // Append receiving log
    po.receivingLogs.push({
      receivedAt: new Date(),
      receivedBy: receivedBy || "Admin",
      cuttingPersonName: cuttingPersonName || "Cutting Master",
      notes: notes || "",
      items: validItems.map((it: any) => ({
        size: it.size,
        item: it.item,
        quantity: it.quantity,
      })),
    });

    // Update status to In Progress if currently Open
    if (po.status === "Open") {
      po.status = "In Progress";
    }

    po.markModified("receivedQuantities");
    po.markModified("receivingLogs");
    await po.save();

    const totalReceivedInThisBatch = validItems.reduce((acc, cur) => acc + cur.quantity, 0);

    return NextResponse.json({
      success: true,
      message: `Successfully received ${totalReceivedInThisBatch} cut pieces from cutting department`,
      purchaseOrder: po,
    });
  } catch (error: any) {
    console.error("Error logging received cut items:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to log received items" },
      { status: 500 }
    );
  }
}
