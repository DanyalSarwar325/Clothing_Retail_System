import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

const DEPARTMENTS = [
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
  "Packing",
  "Store",
];

const ITEM_BASED_DEPARTMENTS = ["Sewing", "Press", "Overlock", "Clipping"];
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

export async function GET(request: NextRequest) {
  try {
    const barcodeDesigns = await prisma.barcode.findMany({
      select: { design: true },
      distinct: ["design"],
      orderBy: { design: "asc" },
    });
    const designs = barcodeDesigns.map((b) => b.design);

    const rawMaterials = await prisma.rawMaterial.findMany({
      include: { items: true },
    });
    const rawMaterialMap: Record<string, { items: { item: string; price: number }[]; totalCost: number }> = {};
    rawMaterials.forEach((rm) => {
      rawMaterialMap[rm.design] = {
        items: rm.items.map((it) => ({ item: it.item, price: it.price })),
        totalCost: rm.totalCost,
      };
    });

    const jobCostingData = await Promise.all(
      designs.map(async (design) => {
        const sampleBarcode = await prisma.barcode.findFirst({
          where: { design },
          include: { departmentRates: true },
        });

        const singleRates: Record<string, number> = {};
        const itemRates: Record<string, Record<string, number>> = {};

        if (sampleBarcode?.departmentRates) {
          sampleBarcode.departmentRates.forEach((r) => {
            if (ITEM_BASED_DEPARTMENTS.includes(r.department) && r.item) {
              if (!itemRates[r.department]) {
                itemRates[r.department] = {};
              }
              itemRates[r.department][r.item] = r.ratePerPiece || 0;
            } else {
              singleRates[r.department] = r.ratePerPiece || 0;
            }
          });
        }

        const sampleFinalSticker = await prisma.finalSticker.findFirst({
          where: { design },
          include: { departmentRates: true },
        });
        const finalStickerRates: Record<string, number> = {};
        if (sampleFinalSticker?.departmentRates) {
          sampleFinalSticker.departmentRates.forEach((r) => {
            finalStickerRates[r.department] = r.ratePerPiece || 0;
          });
        }

        const departmentCosts = await Promise.all(
          DEPARTMENTS.map(async (dept) => {
            if (FINAL_STICKER_DEPARTMENTS.includes(dept)) {
              const count = await prisma.finalStickerScan.count({
                where: {
                  department: dept,
                  finalSticker: { design },
                },
              });
              const rate = finalStickerRates[dept] || 0;
              const cost = count * rate;
              return {
                department: dept,
                scans: count,
                rate,
                cost,
              };
            } else if (ITEM_BASED_DEPARTMENTS.includes(dept)) {
              const scans = await prisma.barcodeScan.findMany({
                where: {
                  department: dept,
                  barcode: { design },
                },
                include: {
                  barcode: { select: { item: true } },
                },
              });

              const itemCounts: Record<string, number> = {};
              for (const s of scans) {
                const item = s.barcode.item;
                itemCounts[item] = (itemCounts[item] || 0) + 1;
              }

              let totalScans = 0;
              let totalCost = 0;
              const itemBreakdown: { item: string; count: number; rate: number; cost: number }[] = [];

              for (const [item, count] of Object.entries(itemCounts)) {
                totalScans += count;
                const rate = itemRates[dept]?.[item] || singleRates[dept] || 0;
                const cost = count * rate;
                totalCost += cost;
                itemBreakdown.push({ item, count, rate, cost });
              }

              const allItemRates = itemRates[dept] || {};

              return {
                department: dept,
                scans: totalScans,
                rate: null,
                cost: totalCost,
                itemBreakdown,
                itemRates: allItemRates,
              };
            } else {
              const count = await prisma.barcodeScan.count({
                where: {
                  department: dept,
                  barcode: { design },
                },
              });
              const rate = singleRates[dept] || 0;
              const cost = count * rate;
              return {
                department: dept,
                scans: count,
                rate,
                cost,
              };
            }
          })
        );

        const totalScans = departmentCosts.reduce((sum, d) => sum + d.scans, 0);
        const laborCost = departmentCosts.reduce((sum, d) => sum + d.cost, 0);

        const rawMaterialData = rawMaterialMap[design] || { items: [], totalCost: 0 };
        const rawMaterialCost = rawMaterialData.totalCost;
        const totalCost = laborCost + rawMaterialCost;

        return {
          design,
          totalScans,
          laborCost,
          rawMaterialCost,
          rawMaterialItems: rawMaterialData.items,
          totalCost,
          departments: departmentCosts,
        };
      })
    );

    jobCostingData.sort((a, b) => b.totalCost - a.totalCost);

    const grandTotalLaborCost = jobCostingData.reduce((sum, d) => sum + d.laborCost, 0);
    const grandTotalRawMaterialCost = jobCostingData.reduce((sum, d) => sum + d.rawMaterialCost, 0);
    const grandTotalCost = jobCostingData.reduce((sum, d) => sum + d.totalCost, 0);
    const grandTotalScans = jobCostingData.reduce((sum, d) => sum + d.totalScans, 0);

    return NextResponse.json({
      success: true,
      data: {
        designs: jobCostingData,
        summary: {
          totalDesigns: designs.length,
          grandTotalScans,
          grandTotalLaborCost,
          grandTotalRawMaterialCost,
          grandTotalCost,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching job costing:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch job costing" },
      { status: 500 }
    );
  }
}
