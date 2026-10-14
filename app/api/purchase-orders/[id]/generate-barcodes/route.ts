import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import PurchaseOrder from "@/app/libs/models/purchaseOrder";
import Barcode from "@/app/libs/models/barcode";

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
    // Accept either a single item { size, item, quantity } or an array of items [{ size, item, quantity }]
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

    // Filter valid entries with quantity > 0
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

    // STRICT CHECK: Verify each item does not exceed received - alreadyBarcoded
    for (const req of requestItems) {
      const received = po.receivedQuantities[req.size]?.[req.item] || 0;
      const alreadyBarcoded = po.barcodedQuantities[req.size]?.[req.item] || 0;
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

    // Rates are inherited directly from the PO (never asked again)
    const rates = po.departmentRates || [];

    const barcodesToInsert: any[] = [];

    // Calculate total planned for the design per item for totalUnits display
    for (const req of requestItems) {
      const suitType = ITEM_TO_SUIT_TYPE[req.item] || "1pc";

      // Count existing barcodes for this design and item to continue sequence numbering
      const existingItemBarcodesCount = await Barcode.countDocuments({
        design: po.design,
        item: req.item,
      });

      // Count existing barcodes for this specific size and item for unitNumber
      const existingSizeUnitCount = await Barcode.countDocuments({
        design: po.design,
        size: req.size,
        item: req.item,
      });

      // Planned total for this item across all sizes in the PO
      const totalPlannedForItem =
        (po.plannedQuantities.S?.[req.item] || 0) +
        (po.plannedQuantities.M?.[req.item] || 0) +
        (po.plannedQuantities.L?.[req.item] || 0);

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

        const cuttingPerson = po.receivingLogs?.slice().reverse().find((l: any) => l.cuttingPersonName)?.cuttingPersonName || "Cutting Master";
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
          departmentHistory: [
            {
              department: "Cutting",
              scannedAt: new Date(),
              scannedBy: cuttingPerson,
            },
            {
              department: "Admin",
              scannedAt: new Date(),
              scannedBy: "Admin",
            },
          ],
          departmentRates: rates, // Inherited from PO
          poId: po._id,
          poNumber: po.poNumber,
        });
      }

      // Update barcodedQuantities on the PO
      const currentBarcoded = po.barcodedQuantities[req.size]?.[req.item] || 0;
      po.barcodedQuantities[req.size][req.item] = currentBarcoded + req.quantity;
    }

    // Insert barcodes
    const createdBarcodes = await Barcode.insertMany(barcodesToInsert);

    // Check if PO is completed
    const SIZES = ["S", "M", "L"] as const;
    const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

    let allPlannedMet = true;
    let anyPlanned = false;
    for (const size of SIZES) {
      for (const item of ITEMS) {
        const planned = po.plannedQuantities[size]?.[item] || 0;
        const barcoded = po.barcodedQuantities[size]?.[item] || 0;
        if (planned > 0) {
          anyPlanned = true;
          if (barcoded < planned) {
            allPlannedMet = false;
          }
        }
      }
    }

    if (anyPlanned && allPlannedMet) {
      po.status = "Completed";
    } else {
      po.status = "In Progress";
    }

    po.markModified("barcodedQuantities");
    await po.save();

    return NextResponse.json({
      success: true,
      message: `${createdBarcodes.length} barcodes generated successfully for PO ${po.poNumber}`,
      count: createdBarcodes.length,
      barcodes: createdBarcodes,
      purchaseOrder: po,
    });
  } catch (error: any) {
    console.error("Error generating barcodes from PO:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate barcodes" },
      { status: 500 }
    );
  }
}
