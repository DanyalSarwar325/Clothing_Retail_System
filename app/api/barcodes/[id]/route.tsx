import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET - Get single barcode by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const barcode = await prisma.barcode.findUnique({
      where: { id },
      include: {
        departmentHistory: true,
        departmentRates: true,
        defectiveInfo: true,
        qualityCheckLogs: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      barcode: {
        ...barcode,
        _id: barcode.id,
      },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const barcode = await prisma.barcode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Barcode status updated to ${status}`,
      barcode: {
        ...barcode,
        _id: barcode.id,
      },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.barcode.delete({
      where: { id },
    });

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
