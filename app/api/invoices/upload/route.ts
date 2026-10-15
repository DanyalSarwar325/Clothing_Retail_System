import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      trackingIds,
      deliveredTrackingIds,
      invoiceFilename,
      extractedText,
    } = body;

    if (!deliveredTrackingIds || !Array.isArray(deliveredTrackingIds)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tracking IDs provided",
        },
        { status: 400 }
      );
    }

    if (deliveredTrackingIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No delivered tracking IDs to process",
        },
        { status: 400 }
      );
    }

    const updatedOrders: any[] = [];
    const failedMatches: any[] = [];
    const processedResults: any[] = [];

    for (const trackingId of deliveredTrackingIds) {
      try {
        const allOrders = await prisma.fulfillmentOrder.findMany();
        const fulfillmentOrder = allOrders.find(
          (fo) => (fo.fulfillment as any)?.trackingNumber === trackingId
        );

        if (!fulfillmentOrder) {
          failedMatches.push({
            trackingId,
            reason: "No matching order found",
          });
          processedResults.push({
            trackingId,
            status: "NOT_FOUND",
            orderStatus: "N/A",
          });
          continue;
        }

        const paymentData = (fulfillmentOrder.payment as any) || {};
        paymentData.status = "paid";

        await prisma.fulfillmentOrder.update({
          where: { id: fulfillmentOrder.id },
          data: {
            payment: paymentData,
          },
        });

        updatedOrders.push({
          orderNumber: fulfillmentOrder.orderNumber || fulfillmentOrder.orderId,
          trackingId,
          orderStatus: (fulfillmentOrder.fulfillment as any)?.status,
        });

        processedResults.push({
          trackingId,
          status: "MARKED_PAID",
          orderStatus: (fulfillmentOrder.fulfillment as any)?.status,
        });
      } catch (error: any) {
        failedMatches.push({
          trackingId,
          reason: error.message,
        });
        processedResults.push({
          trackingId,
          status: "ERROR",
          orderStatus: "N/A",
        });
      }
    }

    try {
      await prisma.invoiceLog.create({
        data: {
          fileName: invoiceFilename || "unknown.pdf",
          fileSize: extractedText?.length || 0,
          uploadedBy: "admin",
          extractedText: extractedText || "",
          trackingIdsFound: trackingIds?.length || 0,
          trackingIds: trackingIds || [],
          processedResults,
          processingSummary: {
            totalTracking: deliveredTrackingIds.length,
            markedPaid: updatedOrders.length,
            skipped: 0,
            notFound: failedMatches.filter((m) => m.reason === "No matching order found").length,
            errors: failedMatches.filter((m) => m.reason !== "No matching order found").length,
          },
        },
      });
    } catch (logError: any) {
      console.error("[Invoice Upload] Error logging to InvoiceLog:", logError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully marked ${updatedOrders.length} orders as paid`,
      summary: {
        totalTrackingIds: trackingIds?.length || 0,
        deliveredTrackingIds: deliveredTrackingIds.length,
        successfulUpdates: updatedOrders.length,
        failedMatches: failedMatches.length,
      },
      updatedOrders,
      failedMatches,
    });
  } catch (error: any) {
    console.error("[Invoice Upload API] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process invoice",
      },
      { status: 500 }
    );
  }
}
