import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import PurchaseOrder from "@/app/libs/models/purchaseOrder";
import Barcode from "@/app/libs/models/barcode";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Single Purchase Order details
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const SIZES = ["S", "M", "L"] as const;
    const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

    let totalPlanned = 0;
    let totalReceived = 0;
    let totalBarcoded = 0;

    for (const size of SIZES) {
      for (const item of ITEMS) {
        totalPlanned += po.plannedQuantities?.[size]?.[item] || 0;
        totalReceived += po.receivedQuantities?.[size]?.[item] || 0;
        totalBarcoded += po.barcodedQuantities?.[size]?.[item] || 0;
      }
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...po.toObject(),
        totalPlanned,
        totalReceived,
        totalBarcoded,
        availableToBarcode: Math.max(0, totalReceived - totalBarcoded),
      },
    });
  } catch (error: any) {
    console.error("Error fetching purchase order:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a Purchase Order (only allowed if no barcodes were generated yet)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check if any barcodes exist for this PO
    const barcodeCount = await Barcode.countDocuments({ poId: po._id });
    const cascade = request.nextUrl.searchParams.get("cascade") === "true";

    if (barcodeCount > 0) {
      if (cascade) {
        // Delete all associated barcodes
        await Barcode.deleteMany({ poId: po._id });
      } else {
        return NextResponse.json(
          {
            success: false,
            hasBarcodes: true,
            barcodeCount,
            message: `PO ${po.poNumber} has ${barcodeCount} barcodes generated. Confirm deletion with cascade to delete both.`,
          },
          { status: 400 }
        );
      }
    }

    await PurchaseOrder.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${po.poNumber} deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
