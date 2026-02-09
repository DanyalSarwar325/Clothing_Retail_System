import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";

// POST - Create multiple barcodes
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodes } = body;

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes provided" },
        { status: 400 }
      );
    }

    // Insert all barcodes
    const insertedBarcodes = await Barcode.insertMany(barcodes);

    return NextResponse.json({
      success: true,
      message: `${insertedBarcodes.length} barcodes created successfully`,
      count: insertedBarcodes.length,
      barcodes: insertedBarcodes,
    });
  } catch (error: any) {
    console.error("Error creating barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create barcodes" },
      { status: 500 }
    );
  }
}

// GET - Get all barcodes with optional filters
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const size = searchParams.get("size");
    const status = searchParams.get("status");

    // Build filter
    const filter: any = {};
    if (design) filter.design = { $regex: design, $options: "i" };
    if (size) filter.size = size;
    if (status) filter.status = status;

    const barcodes = await Barcode.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      count: barcodes.length,
      barcodes,
    });
  } catch (error: any) {
    console.error("Error fetching barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch barcodes" },
      { status: 500 }
    );
  }
}

// DELETE - Delete barcodes by design name
export async function DELETE(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design name is required" },
        { status: 400 }
      );
    }

    // Delete all barcodes with matching design name
    const result = await Barcode.deleteMany({ design: design });

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount} barcodes deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error deleting barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete barcodes" },
      { status: 500 }
    );
  }
}
