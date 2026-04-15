import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FulfillmentOrder from "@/app/libs/models/fulfillmentOrder";

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

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

    console.log(`[Orders Search] Query: "${searchQuery}", Page: ${page}, Limit: ${limit}`);

    // Build MongoDB search query
    // Search by tracking number, order number, customer name, or email
    const mongoQuery = {
      $or: [
        { "fulfillment.trackingNumber": { $regex: searchQuery, $options: "i" } },
        { orderNumber: { $regex: searchQuery, $options: "i" } },
        { "customer.name": { $regex: searchQuery, $options: "i" } },
        { "customer.email": { $regex: searchQuery, $options: "i" } },
        { "customer.phone": { $regex: searchQuery, $options: "i" } },
      ],
    };

    // Execute search with pagination
    const [results, total] = await Promise.all([
      FulfillmentOrder.find(mongoQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FulfillmentOrder.countDocuments(mongoQuery),
    ]);

    console.log(`[Orders Search] Found ${total} results, returning ${results.length} for page ${page}`);

    return NextResponse.json(
      {
        success: true,
        query: searchQuery,
        results: results.map((order: any) => ({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customer?.name,
          customerEmail: order.customer?.email,
          customerPhone: order.customer?.phone,
          trackingNumber: order.fulfillment?.trackingNumber,
          trackingCompany: order.fulfillment?.trackingCompany,
          fulfillmentStatus: order.fulfillment?.status,
          paymentStatus: order.payment?.status,
          total: order.pricing?.total,
          currency: order.pricing?.currency,
          createdAt: order.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + results.length < total,
        },
      },
      { status: 200 }
    );
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
