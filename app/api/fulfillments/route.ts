import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withCORS(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE,PUT");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const skip = parseInt(url.searchParams.get("skip") || "0");

    const where: any = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [rawOrders, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.fulfillmentOrder.count({ where }),
    ]);

    const orders = rawOrders.map((o) => ({
      ...o,
      _id: o.id,
    }));

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

    await prisma.fulfillmentOrder.delete({
      where: { id: fulfillmentId },
    });

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

    const updated = await prisma.fulfillmentOrder.update({
      where: { id: fulfillmentId },
      data: {
        orderNumber: body.orderNumber,
        customer: body.customer,
        shippingAddress: body.shippingAddress,
        product: body.product,
        payment: body.payment,
        fulfillment: body.fulfillment,
        pricing: body.pricing,
        shopifyOrderId: body.shopifyOrderId,
        rawPayload: body.rawPayload,
      },
    });

    return withCORS(
      NextResponse.json({
        success: true,
        data: { ...updated, _id: updated.id },
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
