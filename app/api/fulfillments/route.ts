import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FulfillmentOrder from "@/app/libs/models/fulfillmentOrder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

/**
 * GET - Retrieve all fulfillment orders with optional filtering
 * Query params:
 * - orderId: filter by specific order ID
 * - status: filter by payment status (pending, paid, voided, etc.)
 * - fulfillmentStatus: filter by fulfillment status
 * - startDate: filter by date range (ISO format)
 * - endDate: filter by date range (ISO format)
 * - limit: number of results (default: 50)
 * - skip: pagination offset (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    await DbConnect();

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const paymentStatus = url.searchParams.get("status");
    const fulfillmentStatus = url.searchParams.get("fulfillmentStatus");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0");

    // Build query filter
    const filter: any = {};

    if (orderId) {
      filter.orderId = orderId;
    }

    if (paymentStatus && paymentStatus !== "all") {
      filter["payment.status"] = paymentStatus;
    }

    if (fulfillmentStatus) {
      filter["fulfillment.status"] = fulfillmentStatus;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    console.log("Fetching fulfillment orders with filter:", filter);

    const [orders, total] = await Promise.all([
      FulfillmentOrder.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      FulfillmentOrder.countDocuments(filter),
    ]);

    console.log(`Found ${orders.length} fulfillment orders out of ${total} total`);

    return withCORS(
      NextResponse.json({
        success: true,
        data: orders,
        pagination: {
          total,
          limit,
          skip,
          returned: orders.length,
          pages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error: any) {
    console.error("Error fetching fulfillment orders:", error);
    return withCORS(
      NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to fetch fulfillment orders",
        },
        { status: 500 }
      )
    );
  }
}

/**
 * DELETE - Delete a fulfillment order by ID
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fulfillmentId = url.searchParams.get("id");

    if (!fulfillmentId) {
      return withCORS(
        NextResponse.json(
          { success: false, error: "Fulfillment ID is required" },
          { status: 400 }
        )
      );
    }

    await DbConnect();

    console.log("Deleting fulfillment order:", fulfillmentId);
    const deleted = await FulfillmentOrder.findByIdAndDelete(fulfillmentId);

    if (!deleted) {
      return withCORS(
        NextResponse.json(
          { success: false, error: "Fulfillment order not found" },
          { status: 404 }
        )
      );
    }

    console.log("Fulfillment order deleted successfully:", fulfillmentId);
    return withCORS(
      NextResponse.json({
        success: true,
        message: "Fulfillment order deleted successfully",
      })
    );
  } catch (error: any) {
    console.error("Error deleting fulfillment order:", error);
    return withCORS(
      NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to delete fulfillment order",
        },
        { status: 500 }
      )
    );
  }
}

/**
 * PUT - Update a fulfillment order by ID
 */
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fulfillmentId = url.searchParams.get("id");

    if (!fulfillmentId) {
      return withCORS(
        NextResponse.json(
          { success: false, error: "Fulfillment ID is required" },
          { status: 400 }
        )
      );
    }

    const body = await req.json();

    await DbConnect();

    console.log("Updating fulfillment order:", fulfillmentId);
    const updated = await FulfillmentOrder.findByIdAndUpdate(
      fulfillmentId,
      { ...body, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return withCORS(
        NextResponse.json(
          { success: false, error: "Fulfillment order not found" },
          { status: 404 }
        )
      );
    }

    console.log("Fulfillment order updated successfully:", fulfillmentId);
    return withCORS(
      NextResponse.json({
        success: true,
        data: updated,
        message: "Fulfillment order updated successfully",
      })
    );
  } catch (error: any) {
    console.error("Error updating fulfillment order:", error);
    return withCORS(
      NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to update fulfillment order",
        },
        { status: 500 }
      )
    );
  }
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}
