import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import FinalSticker from "@/app/libs/models/finalSticker";

// GET - Get revenue summary and all dispatched/delivered items
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const design = searchParams.get("design");

    // Build filter
    const filter: any = {};
    if (status) {
      filter.status = status;
    } else if (design) {
      // If design filter is provided, include all relevant statuses
      filter.$or = [
        { status: { $in: ["in_store", "packed", "dispatched", "delivered"] } },
        { currentDepartment: "Store" },
      ];
    }
    // Note: if no status or design filter, we'll fetch all items below
    if (design) filter.design = design;

    // Get all relevant items - include packed items and items in Store department
    let items;
    if (!status && !design) {
      // No filters - get all items that could be in revenue tracking
      items = await FinalSticker.find({
        $or: [
          { status: { $in: ["in_store", "packed", "dispatched", "delivered"] } },
          { currentDepartment: "Store" },
        ]
      }).sort({ updatedAt: -1 });
    } else {
      items = await FinalSticker.find(filter).sort({ updatedAt: -1 });
    }

    // Calculate summary
    // Items are "in store" if status is "in_store" OR currentDepartment is "Store" (and not dispatched/delivered)
    const inStoreItems = items.filter((i: any) => 
      i.status === "in_store" || 
      i.status === "packed" ||
      (i.currentDepartment === "Store" && !["dispatched", "delivered"].includes(i.status))
    );
    const dispatchedItems = items.filter((i: any) => i.status === "dispatched");
    const deliveredItems = items.filter((i: any) => i.status === "delivered");

    const totalInStore = inStoreItems.length;
    const totalDispatched = dispatchedItems.length;
    const totalDelivered = deliveredItems.length;

    // Financial calculations
    const totalCreditSale = dispatchedItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);
    const totalRevenue = deliveredItems.reduce((sum, item) => sum + (item.paymentInfo?.amountReceived || 0), 0);
    const totalPending = totalCreditSale; // All dispatched items are pending payment

    // Get pending payment amount from delivered items (if partial payment)
    const pendingFromDelivered = deliveredItems.reduce((sum, item) => {
      const received = item.paymentInfo?.amountReceived || 0;
      const price = item.sellingPrice || 0;
      return sum + (price - received);
    }, 0);

    // Inventory value
    const inventoryValue = inStoreItems.reduce((sum, item) => sum + (item.sellingPrice || 0), 0);

    return NextResponse.json({
      success: true,
      summary: {
        // Counts
        totalInStore,
        totalDispatched,
        totalDelivered,
        totalItems: totalInStore + totalDispatched + totalDelivered,
        
        // Financial
        inventoryValue,           // Value of items in store
        totalCreditSale,          // Value of dispatched items (pending delivery)
        totalRevenue,             // Money received from delivered items
        totalPending: totalCreditSale + pendingFromDelivered, // Total money pending
        pendingFromDelivered,     // Partial payments pending from delivered
      },
      items: {
        inStore: inStoreItems,
        dispatched: dispatchedItems,
        delivered: deliveredItems,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
