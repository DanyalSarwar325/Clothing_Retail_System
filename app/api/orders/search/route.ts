import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query is required",
        },
        { status: 400 }
      );
    }

    const skip = (page - 1) * limit;
    const searchQuery = query.trim();

    const where: any = {
      OR: [
        { orderNumber: { contains: searchQuery, mode: "insensitive" } },
        { orderId: { contains: searchQuery, mode: "insensitive" } },
        { shopifyOrderId: { contains: searchQuery, mode: "insensitive" } },
      ],
    };

    const [results, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.fulfillmentOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      query: searchQuery,
      results: results.map((order) => {
        const customer = (order.customer as any) || {};
        const fulfillment = (order.fulfillment as any) || {};
        const payment = (order.payment as any) || {};
        const pricing = (order.pricing as any) || {};

        return {
          _id: order.id,
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          trackingNumber: fulfillment.trackingNumber,
          trackingCompany: fulfillment.trackingCompany,
          fulfillmentStatus: fulfillment.status,
          paymentStatus: payment.status,
          total: pricing.total,
          currency: pricing.currency,
          createdAt: order.createdAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + results.length < total,
      },
    });
  } catch (error: any) {
    console.error("[Orders Search API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search orders",
      },
      { status: 500 }
    );
  }
}
