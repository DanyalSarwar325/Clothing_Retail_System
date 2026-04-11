import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/libs/dbConnect";
import InvoiceLog from "@/app/libs/models/invoiceLog";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Fetch all invoice logs, sorted by created date (newest first)
    const invoices = await InvoiceLog.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      invoices: invoices || [],
    });
  } catch (error: any) {
    console.error("Error fetching invoice history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch invoice history",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
