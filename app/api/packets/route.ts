import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// POST - Create a packet from 3 scanned barcodes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcodeDataList, packedBy } = body;

    // Validate input
    if (!barcodeDataList || !Array.isArray(barcodeDataList) || barcodeDataList.length !== 3) {
      return NextResponse.json(
        { success: false, message: "Exactly 3 barcodes are required to create a packet" },
        { status: 400 }
      );
    }

    if (!packedBy) {
      return NextResponse.json(
        { success: false, message: "packedBy is required" },
        { status: 400 }
      );
    }

    // Find all 3 barcodes
    const barcodes = await prisma.barcode.findMany({
      where: {
        barcodeData: { in: barcodeDataList },
      },
    });

    if (barcodes.length !== 3) {
      return NextResponse.json(
        { success: false, message: `Only ${barcodes.length} of 3 barcodes found in database` },
        { status: 400 }
      );
    }

    // Validate all barcodes are from the same unit (same design, size, unitNumber)
    const firstBarcode = barcodes[0];
    const { design, size, unitNumber } = firstBarcode;

    const allSameUnit = barcodes.every(
      (b) => b.design === design && b.size === size && b.unitNumber === unitNumber
    );

    if (!allSameUnit) {
      return NextResponse.json(
        {
          success: false,
          message: "All 3 items must be from the same unit (same design, size, and unit number)",
          details: barcodes.map((b) => ({
            item: b.item,
            design: b.design,
            size: b.size,
            unitNumber: b.unitNumber,
          })),
        },
        { status: 400 }
      );
    }

    // Check we have all 3 items: Shalwar, Qameez, Dupatta
    const items = barcodes.map((b) => b.item).sort();
    const requiredItems = ["Dupatta", "Qameez", "Shalwar"] as const;
    const sortedRequiredItems = [...requiredItems].sort();

    if (JSON.stringify(items) !== JSON.stringify(sortedRequiredItems)) {
      const missingItems = sortedRequiredItems.filter((item) => !items.includes(item));
      return NextResponse.json(
        {
          success: false,
          message: `Missing items: ${missingItems.join(", ")}. A packet must contain Shalwar, Qameez, and Dupatta.`,
          scannedItems: items,
          missingItems,
        },
        { status: 400 }
      );
    }

    // Check if any barcode is already packed
    const alreadyPacked = barcodes.filter((b) => b.status === "packed");
    if (alreadyPacked.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${alreadyPacked.length} item(s) already packed: ${alreadyPacked.map((b) => b.item).join(", ")}`,
          alreadyPacked: alreadyPacked.map((b) => b.item),
        },
        { status: 400 }
      );
    }

    // Check if a packet already exists for this unit
    const existingPacket = await prisma.packet.findFirst({
      where: { design, size, unitNumber },
    });
    if (existingPacket) {
      return NextResponse.json(
        {
          success: false,
          message: `Packet already exists for ${design} - Size ${size} - Unit #${unitNumber}`,
          existingPacketId: existingPacket.packetId,
        },
        { status: 400 }
      );
    }

    // Generate packet ID and barcode data
    const packetId = `PKT-${design.substring(0, 3).toUpperCase()}-${size}-${unitNumber}-${Date.now().toString(36).toUpperCase()}`;
    const packetBarcodeData = JSON.stringify({
      type: "packet",
      packetId,
      design,
      size,
      unitNumber,
      items: ["Shalwar", "Qameez", "Dupatta"],
      packedAt: new Date().toISOString(),
    });

    const now = new Date();

    const packet = await prisma.$transaction(async (tx) => {
      // Create packet
      const pkt = await tx.packet.create({
        data: {
          packetId,
          design,
          size,
          unitNumber,
          barcodeIds: barcodes.map((b) => b.id),
          items: barcodes.map((b) => ({
            item: b.item,
            barcodeId: b.id,
            barcodeData: b.barcodeData,
          })),
          packetBarcodeData,
          status: "packed",
          packedBy,
          packedAt: now,
        },
      });

      // Update all barcodes to "packed" status and record Packing scan
      for (const b of barcodes) {
        await tx.barcode.update({
          where: { id: b.id },
          data: {
            status: "packed",
            currentDepartment: "Packing",
            scannedAt: now,
          },
        });

        await tx.barcodeScan.create({
          data: {
            barcodeId: b.id,
            department: "Packing",
            scannedAt: now,
            scannedBy: packedBy,
          },
        });
      }

      return pkt;
    });

    return NextResponse.json({
      success: true,
      message: `Packet created successfully for ${design} - Size ${size} - Unit #${unitNumber}`,
      packet: {
        packetId: packet.packetId,
        design: packet.design,
        size: packet.size,
        unitNumber: packet.unitNumber,
        items: (packet.items as any[]).map((i) => i.item),
        packetBarcodeData: packet.packetBarcodeData,
        packedBy: packet.packedBy,
        packedAt: packet.packedAt,
        _id: packet.id,
      },
    });
  } catch (error: any) {
    console.error("Error creating packet:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create packet" },
      { status: 500 }
    );
  }
}

// GET - Get all packets or filter by design/size
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const size = searchParams.get("size");
    const packedBy = searchParams.get("packedBy");

    const where: any = {};
    if (design) where.design = { contains: design, mode: "insensitive" };
    if (size) where.size = size;
    if (packedBy) where.packedBy = packedBy;

    const packets = await prisma.packet.findMany({
      where,
      orderBy: { packedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      count: packets.length,
      packets: packets.map((p) => ({ ...p, _id: p.id })),
    });
  } catch (error: any) {
    console.error("Error fetching packets:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch packets" },
      { status: 500 }
    );
  }
}
