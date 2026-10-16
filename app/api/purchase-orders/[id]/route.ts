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

    const rates = po.departmentRates || [];
    const defaultCuttingRate =
      rates.find((r: any) => r.department === "Cutting" && !r.item)?.ratePerPiece ??
      rates.find((r: any) => r.department === "Cutting")?.ratePerPiece ??
      5;

    const enrichedLogs = (po.receivingLogs || []).map((log: any) => {
      let batchTotalAmount = 0;
      let batchPaidAmount = 0;
      let batchPiecesCount = 0;

      const enrichedItems = (log.items || []).map((it: any) => {
        const itemRate =
          rates.find((r: any) => r.department === "Cutting" && r.item === it.item)?.ratePerPiece ??
          defaultCuttingRate;
        const totalEarned = it.quantity * itemRate;
        const paid = it.isPaid ? it.paidAmount ?? totalEarned : 0;
        const pending = it.isPaid ? 0 : totalEarned;

        batchPiecesCount += it.quantity;
        batchTotalAmount += totalEarned;
        batchPaidAmount += paid;

        return {
          ...it,
          _id: it.id,
          rate: itemRate,
          totalEarned,
          paidAmount: paid,
          pendingAmount: pending,
        };
      });

      const batchPendingAmount = Math.max(0, batchTotalAmount - batchPaidAmount);
      const isFullyPaid = batchPendingAmount === 0 && batchPiecesCount > 0;
      const isPartial = batchPaidAmount > 0 && batchPendingAmount > 0;
      const paymentStatus = isFullyPaid ? "Paid" : isPartial ? "Partial" : "Pending";

      const voucherNumber =
        log.voucherNumber || log.items?.find((i: any) => i.voucherNumber)?.voucherNumber || null;
      const paymentMode =
        log.paymentMode || log.items?.find((i: any) => i.paymentMode)?.paymentMode || null;
      const paidAt = log.items?.find((i: any) => i.paidAt)?.paidAt || null;

      return {
        ...log,
        _id: log.id,
        items: enrichedItems,
        batchPiecesCount,
        batchTotalAmount,
        batchPaidAmount,
        batchPendingAmount,
        paymentStatus,
        voucherNumber,
        paymentMode,
        paidAt,
      };
    });

    const totalCuttingCost = enrichedLogs.reduce((sum: number, l: any) => sum + l.batchTotalAmount, 0);
    const totalCuttingPaid = enrichedLogs.reduce((sum: number, l: any) => sum + l.batchPaidAmount, 0);
    const totalCuttingPending = Math.max(0, totalCuttingCost - totalCuttingPaid);
    const cuttingPaymentStatus =
      totalCuttingPending === 0 && totalReceived > 0
        ? "Paid"
        : totalCuttingPaid > 0
        ? "Partial"
        : "Pending";

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        ...po,
        _id: po.id,
        totalPlanned,
        totalReceived,
        totalBarcoded,
        availableToBarcode: Math.max(0, totalReceived - totalBarcoded),
        receivingLogs: enrichedLogs,
        totalCuttingCost,
        totalCuttingPaid,
        totalCuttingPending,
        cuttingPaymentStatus,
        defaultCuttingRate,
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
