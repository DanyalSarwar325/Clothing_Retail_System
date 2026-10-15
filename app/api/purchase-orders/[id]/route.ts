import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Single Purchase Order details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        departmentRates: true,
        receivingLogs: {
          include: { items: true },
        },
      },
    });

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

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...po,
        _id: po.id,
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

// DELETE - Delete a Purchase Order (only allowed if no barcodes were generated yet or cascade)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      return NextResponse.json(
        { success: false, message: "Purchase Order not found" },
        { status: 404 }
      );
    }

    const barcodeCount = await prisma.barcode.count({ where: { poId: po.id } });
    const cascade = request.nextUrl.searchParams.get("cascade") === "true";

    if (barcodeCount > 0) {
      if (cascade) {
        await prisma.barcode.deleteMany({ where: { poId: po.id } });
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

    await prisma.purchaseOrder.delete({ where: { id } });

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
