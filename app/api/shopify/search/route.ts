import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/libs/dbConnect";
import FulfillmentOrder from "@/app/libs/models/fulfillmentOrder";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "fulfillment"; // "creation" or "fulfillment"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    if (!query.trim()) {
      return NextResponse.json({
        success: false,
        error: "Search query required",
      }, { status: 400 });
    }

    const searchQuery = query.toLowerCase();

    // Build MongoDB search filter
    const filter: any = {
      $or: [
        { orderName: { $regex: searchQuery, $options: "i" } },
        { shopifyOrderId: { $regex: searchQuery, $options: "i" } },
        { customerName: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
        { "fulfillment.trackingNumber": { $regex: searchQuery, $options: "i" } },
      ],
    };

    // If searching for creation orders, filter by financialStatus
    if (type === "creation") {
      filter["payment.status"] = { $ne: "refunded" };
    }

    // Get total count for pagination
    const total = await FulfillmentOrder.countDocuments(filter);

    // Search across ALL orders in database
    const orders = await FulfillmentOrder.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ receivedAt: -1 })
      .lean();

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      orders: orders.map(order => ({
        _id: order._id,
        orderName: order.orderName,
        shopifyOrderId: order.shopifyOrderId,
        customerName: order.customer?.name || "N/A",
        totalPrice: order.pricing?.total.toFixed(2) || "0",
        currency: order.pricing?.currency || "PKR",
        email: order.customer?.email || "N/A",
        phone: order.customer?.phone || "N/A",
        address: order.shippingAddress?.address || "N/A",
        financialStatus: order.payment?.status,
        fulfillmentStatus: order.fulfillment?.status,
        trackingNumber: order.fulfillment?.trackingNumber,
        trackingCompany: order.fulfillment?.trackingCompany,
        receivedAt: order.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("[Search Orders] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search orders",
      },
      { status: 500 }
    );
  }
}
