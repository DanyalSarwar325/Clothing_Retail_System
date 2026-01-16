import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";

// GET - Get single barcode by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DbConnect();

    const barcode = await Barcode.findById(params.id);

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      barcode,
    });
  } catch (error: any) {
    console.error("Error fetching barcode:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch barcode" },
      { status: 500 }
    );
  }
}

// PATCH - Update barcode status (e.g., mark as sold)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DbConnect();

    const body = await request.json();
    const { status } = body;

    if (!status || !["available", "sold", "returned"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Valid status is required (available, sold, returned)" },
        { status: 400 }
      );
    }

    const updateData: any = { status };
    if (status === "sold") {
      updateData.soldAt = new Date();
    }

    const barcode = await Barcode.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true }
    );

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Barcode status updated to ${status}`,
      barcode,
    });
  } catch (error: any) {
    console.error("Error updating barcode:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update barcode" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a barcode
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await DbConnect();

    const barcode = await Barcode.findByIdAndDelete(params.id);

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Barcode deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting barcode:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete barcode" },
      { status: 500 }
    );
  }
}
