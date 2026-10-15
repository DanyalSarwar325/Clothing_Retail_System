import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET() {
  try {
    const barcodeDesigns = await prisma.barcode.findMany({
      select: { design: true },
      distinct: ["design"],
      orderBy: { design: "asc" },
    });
    const designs = barcodeDesigns.map((b) => b.design);

    const scans = await prisma.barcodeScan.findMany({
      where: { scannedBy: { not: null } },
      select: { scannedBy: true },
      distinct: ["scannedBy"],
      orderBy: { scannedBy: "asc" },
    });

    const stickerScans = await prisma.finalStickerScan.findMany({
      where: { scannedBy: { not: null } },
      select: { scannedBy: true },
      distinct: ["scannedBy"],
      orderBy: { scannedBy: "asc" },
    });

    const allWorkers = new Set<string>();
    scans.forEach((s) => {
      if (s.scannedBy) allWorkers.add(s.scannedBy);
    });
    stickerScans.forEach((s) => {
      if (s.scannedBy) allWorkers.add(s.scannedBy);
    });

    const workers = Array.from(allWorkers).sort();

    return NextResponse.json({
      success: true,
      data: {
        designs,
        workers,
      },
    });
  } catch (error: any) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch options" },
      { status: 500 }
    );
  }
}
