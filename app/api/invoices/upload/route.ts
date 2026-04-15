import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FulfillmentOrder from "@/app/libs/models/fulfillmentOrder";
import InvoiceLog from "@/app/libs/models/invoiceLog";

export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const {
      trackingIds,
      deliveredTrackingIds,
      invoiceFilename,
      extractedText,
    } = body;

    console.log("[Invoice Upload API] Processing request...", {
      totalTrackingIds: trackingIds?.length || 0,
      deliveredTrackingIds: deliveredTrackingIds?.length || 0,
      invoiceFilename,
    });

    // Validate input
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

    // Process each tracking ID
    const updatedOrders: any[] = [];
    const failedMatches: any[] = [];
    const processedResults: any[] = [];

    for (const trackingId of deliveredTrackingIds) {
      try {
        // Find fulfillment order by tracking number
        const fulfillmentOrder = await FulfillmentOrder.findOne({
          "fulfillment.trackingNumber": trackingId,
        });

        if (!fulfillmentOrder) {
          console.warn(`[Invoice Upload] Tracking ID not found: ${trackingId}`);
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

        // Update payment status to "paid"
        fulfillmentOrder.payment.status = "paid";
        fulfillmentOrder.updatedAt = new Date();
        
        await fulfillmentOrder.save();

        console.log(
          `[Invoice Upload] Updated order ${fulfillmentOrder.orderNumber} (Tracking: ${trackingId}) to PAID`
        );

        updatedOrders.push({
          orderNumber: fulfillmentOrder.orderNumber || fulfillmentOrder.orderId,
          trackingId,
          orderStatus: fulfillmentOrder.fulfillment?.status,
        });

        processedResults.push({
          trackingId,
          status: "MARKED_PAID",
          orderStatus: fulfillmentOrder.fulfillment?.status,
        });
      } catch (error: any) {
        console.error(
          `[Invoice Upload] Error processing tracking ID ${trackingId}:`,
          error
        );
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

    // Log to InvoiceLog collection
    try {
      await InvoiceLog.create({
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
      });
      console.log("[Invoice Upload] Logged to InvoiceLog collection");
    } catch (logError: any) {
      console.error("[Invoice Upload] Error logging to InvoiceLog:", logError);
    }

    // Return success response
    return NextResponse.json(
      {
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
      },
      { status: 200 }
    );
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
