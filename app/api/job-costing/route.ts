import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    // Get all rates
    const rates = await Rate.find({});
    const rateMap: Record<string, number> = {};
    rates.forEach((r) => {
      rateMap[r.department] = r.ratePerUnit || 0;
    });

    // Get all unique designs
    const designs = await Barcode.distinct("design");

    // For each design, calculate cost per department
    const jobCostingData = await Promise.all(
      designs.map(async (design) => {
        const departmentCosts = await Promise.all(
          DEPARTMENTS.map(async (dept) => {
            const count = await Barcode.countDocuments({
              design,
              "departmentHistory.department": dept,
            });
            const rate = rateMap[dept] || 0;
            const cost = count * rate;
            return {
              department: dept,
              scans: count,
              rate,
              cost,
            };
          })
        );

        const totalScans = departmentCosts.reduce((sum, d) => sum + d.scans, 0);
        const totalCost = departmentCosts.reduce((sum, d) => sum + d.cost, 0);

        return {
          design,
          totalScans,
          totalCost,
          departments: departmentCosts,
        };
      })
    );

    // Sort by total cost descending
    jobCostingData.sort((a, b) => b.totalCost - a.totalCost);

    // Calculate grand totals
    const grandTotalCost = jobCostingData.reduce((sum, d) => sum + d.totalCost, 0);
    const grandTotalScans = jobCostingData.reduce((sum, d) => sum + d.totalScans, 0);

    return NextResponse.json({
      success: true,
      data: {
        designs: jobCostingData,
        summary: {
          totalDesigns: designs.length,
          grandTotalScans,
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
