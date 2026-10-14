import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// GET - Get store inventory summary and items
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const filter: any = {};
    if (status) {
      if (status === "returned") {
        filter["returnInfo.returnedAt"] = { $exists: true };
      } else {
        filter.status = status;
      }
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { design: regex },
        { "dispatchInfo.checkoutType": regex },
        { "dispatchInfo.customerName": regex },
        { "dispatchInfo.remarks": regex },
      ];
    }

    const items = await FinalSticker.find(filter)
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean();

    // Summary calculations across all store items
    const allStickers = await FinalSticker.find({
      status: { $in: ["in_store", "packed", "dispatched", "delivered", "returned"] },
    })
      .select("status sellingPrice paymentInfo returnInfo")
      .lean();

    const inStoreList = allStickers.filter(
      (s: any) => s.status === "in_store" || s.status === "packed"
    );
    const dispatchedList = allStickers.filter((s: any) => s.status === "dispatched");
    const deliveredList = allStickers.filter((s: any) => s.status === "delivered");
    const returnedList = allStickers.filter((s: any) => !!s.returnInfo?.returnedAt);

    const totalInStore = inStoreList.length;
    const totalDispatched = dispatchedList.length;
    const totalDelivered = deliveredList.length;
    const totalReturned = returnedList.length;

    const inventoryValue = inStoreList.reduce((acc, s: any) => acc + (s.sellingPrice || 0), 0);
    const dispatchedValue = dispatchedList.reduce((acc, s: any) => acc + (s.sellingPrice || 0), 0);
    const totalRevenue = deliveredList.reduce(
      (acc, s: any) => acc + (s.paymentInfo?.amountReceived || 0),
      0
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalInStore,
        totalDispatched,
        totalDelivered,
        totalReturned,
        inventoryValue,
        dispatchedValue,
        totalRevenue,
      },
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
