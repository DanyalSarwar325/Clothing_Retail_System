import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import RawMaterial from "@/app/libs/models/rawMaterial";

const DEPARTMENTS = [
  "Cutting",
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

// Departments that have item-based rates (Qameez, Shalwar, Dupatta)
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Press", "Overlock", "Clipping"];

// Departments that use FinalSticker instead of Barcode
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    // Get all unique designs
    const designs = await Barcode.distinct("design");

    // Get all raw materials
    const rawMaterials = await RawMaterial.find({});
    const rawMaterialMap: Record<string, { items: { item: string; price: number }[]; totalCost: number }> = {};
    rawMaterials.forEach((rm) => {
      rawMaterialMap[rm.design] = {
        items: rm.items,
        totalCost: rm.totalCost,
      };
    });

    // For each design, calculate cost per department using the rates stored in barcodes
    const jobCostingData = await Promise.all(
      designs.map(async (design) => {
        // Get one barcode for this design to get the department rates
        const sampleBarcode = await Barcode.findOne({ design }).select("departmentRates");
        
        // Build rate maps from the design's stored rates
        // For single-rate departments: dept -> rate
        // For item-based departments: dept+item -> rate
        const singleRates: Record<string, number> = {};
        const itemRates: Record<string, Record<string, number>> = {};
        
        if (sampleBarcode?.departmentRates) {
          sampleBarcode.departmentRates.forEach((r: any) => {
            if (ITEM_BASED_DEPARTMENTS.includes(r.department) && r.item) {
              // Item-based rate
              if (!itemRates[r.department]) {
                itemRates[r.department] = {};
              }
              itemRates[r.department][r.item] = r.ratePerPiece || 0;
            } else {
              // Single rate (or legacy rate without item)
              singleRates[r.department] = r.ratePerPiece || 0;
            }
          });
        }

        // Get FinalSticker rates for Packing and Store
        const sampleFinalSticker = await FinalSticker.findOne({ design }).select("departmentRates");
        const finalStickerRates: Record<string, number> = {};
        if (sampleFinalSticker?.departmentRates) {
          sampleFinalSticker.departmentRates.forEach((r: any) => {
            finalStickerRates[r.department] = r.ratePerPiece || 0;
          });
        }

        const departmentCosts = await Promise.all(
          DEPARTMENTS.map(async (dept) => {
            // For Packing and Store, use FinalSticker model
            if (FINAL_STICKER_DEPARTMENTS.includes(dept)) {
              const count = await FinalSticker.countDocuments({
                design,
                "departmentHistory.department": dept,
              });
              const rate = finalStickerRates[dept] || 0;
              const cost = count * rate;
              return {
                department: dept,
                scans: count,
                rate, // Rate from FinalSticker
                cost,
              };
            }
            // For item-based departments, we need to calculate cost per item
            else if (ITEM_BASED_DEPARTMENTS.includes(dept)) {
              // Get scans with item info for this department
              const scannedItems = await Barcode.aggregate([
                { 
                  $match: { 
                    design,
                    "departmentHistory.department": dept,
                  } 
                },
                {
                  $project: {
                    item: 1,
                  }
                },
                {
                  $group: {
                    _id: "$item",
                    count: { $sum: 1 },
                  }
                }
              ]);

              let totalScans = 0;
              let totalCost = 0;
              const itemBreakdown: { item: string; count: number; rate: number; cost: number }[] = [];

              for (const { _id: item, count } of scannedItems) {
                totalScans += count;
                const rate = itemRates[dept]?.[item] || singleRates[dept] || 0;
                const cost = count * rate;
                totalCost += cost;
                itemBreakdown.push({ item, count, rate, cost });
              }

              // Include all item rates even if no scans (to show admin-entered rates)
              const allItemRates = itemRates[dept] || {};

              return {
                department: dept,
                scans: totalScans,
                rate: null, // Multiple rates for item-based
                cost: totalCost,
                itemBreakdown,
                itemRates: allItemRates, // Include all rates admin entered
              };
            } else {
              // Single rate department (Quality, Handmade, Adda Work, Patching)
              const count = await Barcode.countDocuments({
                design,
                "departmentHistory.department": dept,
              });
              const rate = singleRates[dept] || 0;
              const cost = count * rate;
              return {
                department: dept,
                scans: count,
                rate, // Always show the admin-entered rate
                cost,
              };
            }
          })
        );

        const totalScans = departmentCosts.reduce((sum, d) => sum + d.scans, 0);
        const laborCost = departmentCosts.reduce((sum, d) => sum + d.cost, 0);
        
        // Get raw material cost for this design
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

    // Sort by total cost descending
    jobCostingData.sort((a, b) => b.totalCost - a.totalCost);

    // Calculate grand totals
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
