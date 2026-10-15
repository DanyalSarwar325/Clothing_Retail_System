import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const design = searchParams.get("design");

    if (design) {
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { design },
        include: { items: true },
      });

      const formatted = rawMaterial
        ? {
            ...rawMaterial,
            _id: rawMaterial.id,
            items: rawMaterial.items.map((it) => ({ ...it, _id: it.id })),
          }
        : null;

      return NextResponse.json({
        success: true,
        data: formatted,
      });
    }

    const rawMaterials = await prisma.rawMaterial.findMany({
      include: { items: true },
      orderBy: { design: "asc" },
    });

    const formattedMaterials = rawMaterials.map((rm) => ({
      ...rm,
      _id: rm.id,
      items: rm.items.map((it) => ({ ...it, _id: it.id })),
    }));

    const barcodeDesigns = await prisma.barcode.findMany({
      select: { design: true },
      distinct: ["design"],
      orderBy: { design: "asc" },
    });
    const designs = barcodeDesigns.map((b) => b.design);

    return NextResponse.json({
      success: true,
      data: {
        rawMaterials: formattedMaterials,
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

export async function POST(request: NextRequest) {
  try {
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

    for (const item of items) {
      if (!item.item || typeof item.price !== "number") {
        return NextResponse.json(
          { success: false, message: "Each item must have 'item' (string) and 'price' (number)" },
          { status: 400 }
        );
      }
    }

    const totalCost = items.reduce((acc: number, it: any) => acc + (it.price || 0), 0);

    const rawMaterial = await prisma.$transaction(async (tx) => {
      await tx.rawMaterial.deleteMany({ where: { design } });

      return tx.rawMaterial.create({
        data: {
          design,
          totalCost,
          items: {
            create: items.map((it: any) => ({
              item: it.item,
              price: it.price,
            })),
          },
        },
        include: { items: true },
      });
    });

    const formatted = {
      ...rawMaterial,
      _id: rawMaterial.id,
      items: rawMaterial.items.map((it) => ({ ...it, _id: it.id })),
    };

    return NextResponse.json({
      success: true,
      message: "Raw materials saved successfully",
      data: formatted,
    });
  } catch (error: any) {
    console.error("Error saving raw materials:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save raw materials" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const design = searchParams.get("design");

    if (!design) {
      return NextResponse.json(
        { success: false, message: "Design is required" },
        { status: 400 }
      );
    }

    await prisma.rawMaterial.deleteMany({
      where: { design },
    });

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
