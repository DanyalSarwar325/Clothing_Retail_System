import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import RawMaterial from "@/app/libs/models/rawMaterial";
import Barcode from "@/app/libs/models/barcode";

// GET - Get all raw materials or for a specific design
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const design = searchParams.get("design");

    if (design) {
      const rawMaterial = await RawMaterial.findOne({ design });
      return NextResponse.json({
        success: true,
        data: rawMaterial || null,
      });
    }

    // Get all raw materials
    const rawMaterials = await RawMaterial.find({}).sort({ design: 1 });

    // Get all unique designs from barcodes
    const designs = await Barcode.distinct("design");

    return NextResponse.json({
      success: true,
      data: {
        rawMaterials,
        designs,
      },
    });
  } catch (error: any) {
    console.error("Error fetching raw materials:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch raw materials" },
      { status: 500 }
    );
  }
}

// POST - Create or update raw material for a design
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { design, items } = body;

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: "Items array is required" },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of items) {
      if (!item.item || typeof item.price !== "number") {
        return NextResponse.json(
          { success: false, message: "Each item must have 'item' (string) and 'price' (number)" },
          { status: 400 }
        );
      }
    }

    // Find existing or create new
    let rawMaterial = await RawMaterial.findOne({ design });

    if (rawMaterial) {
      // Update existing
      rawMaterial.items = items;
      await rawMaterial.save();
    } else {
      // Create new
      rawMaterial = new RawMaterial({
        design,
        items,
      });
      await rawMaterial.save();
    }

    return NextResponse.json({
      success: true,
      message: "Raw materials saved successfully",
      data: rawMaterial,
    });
  } catch (error: any) {
    console.error("Error saving raw materials:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save raw materials" },
      { status: 500 }
    );
  }
}

// DELETE - Delete raw material for a design
export async function DELETE(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const design = searchParams.get("design");

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design is required" },
        { status: 400 }
      );
    }

    await RawMaterial.deleteOne({ design });

    return NextResponse.json({
      success: true,
      message: "Raw materials deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting raw materials:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete raw materials" },
      { status: 500 }
    );
  }
}
