import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    if (!query.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query required",
        },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();

    const where: any = {
      OR: [
        { orderNumber: { contains: searchQuery, mode: "insensitive" } },
        { shopifyOrderId: { contains: searchQuery, mode: "insensitive" } },
        { orderId: { contains: searchQuery, mode: "insensitive" } },
      ],
    };

    const [orders, total] = await Promise.all([
      prisma.fulfillmentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.fulfillmentOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => {
        const customer = (order.customer as any) || {};
        const fulfillment = (order.fulfillment as any) || {};
        const payment = (order.payment as any) || {};
        const pricing = (order.pricing as any) || {};

        return {
          _id: order.id,
          id: order.id,
          orderName: order.orderNumber,
          shopifyOrderId: order.shopifyOrderId,
          customerName: customer.name || "N/A",
          totalPrice: pricing.total || "0.00",
          currency: pricing.currency || "PKR",
          email: customer.email || "N/A",
          phone: customer.phone || "N/A",
          financialStatus: payment.status || "N/A",
          fulfillmentStatus: fulfillment.status || "unfulfilled",
          trackingNumber: fulfillment.trackingNumber || "N/A",
          trackingCompany: fulfillment.trackingCompany || "N/A",
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Shopify search error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to search orders" },
      { status: 500 }
    );
  }
}
