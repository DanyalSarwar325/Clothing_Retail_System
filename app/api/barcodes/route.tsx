import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// POST - Create multiple barcodes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcodes } = body;

    if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
      return NextResponse.json(
        { success: false, message: "No barcodes provided" },
        { status: 400 }
      );
    }

    const createdList: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const b of barcodes) {
        const created = await tx.barcode.create({
          data: {
            design: b.design,
            size: b.size,
            suitType: b.suitType || "3pc",
            item: b.item,
            unitNumber: b.unitNumber,
            sequenceNumber: b.sequenceNumber || 0,
            totalUnitsInBatch: b.totalUnitsInBatch || 0,
            barcodeData: b.barcodeData,
            status: b.status || "generated",
            currentDepartment: b.currentDepartment || "Cutting",
            poNumber: b.poNumber || null,
            departmentRates:
              b.departmentRates && Array.isArray(b.departmentRates)
                ? {
                    create: b.departmentRates.map((r: any) => ({
                      department: r.department,
                      ratePerPiece: Number(r.ratePerPiece) || 0,
                      item: r.item || null,
                    })),
                  }
                : undefined,
          },
        });
        createdList.push({
          ...created,
          _id: created.id,
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `${createdList.length} barcodes created successfully`,
      count: createdList.length,
      barcodes: createdList,
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
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const size = searchParams.get("size");
    const status = searchParams.get("status");

    const where: any = {};
    if (design) where.design = { contains: design, mode: "insensitive" };
    if (size) where.size = size;
    if (status) where.status = status;

    const barcodes = await prisma.barcode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        departmentHistory: true,
        departmentRates: true,
        defectiveInfo: true,
      },
    });

    const formatted = barcodes.map((b) => ({
      ...b,
      _id: b.id,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      barcodes: formatted,
    });
  } catch (error: any) {
    console.error("Error fetching barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch barcodes" },
      { status: 500 }
    );
  }
}

// DELETE - Delete barcodes by design name or specific barcode IDs
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const idsParam = searchParams.get("ids");

    let where: any = {};
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, message: "No valid barcode IDs provided" },
          { status: 400 }
        );
      }
      where = { id: { in: ids } };
    } else if (design) {
      where = { design };
    } else {
      return NextResponse.json(
        { success: false, message: "Design name or barcode IDs are required" },
        { status: 400 }
      );
    }

    const result = await prisma.barcode.deleteMany({
      where,
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} barcodes deleted successfully`,
      deletedCount: result.count,
    });
  } catch (error: any) {
    console.error("Error deleting barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete barcodes" },
      { status: 500 }
    );
  }
}
