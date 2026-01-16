import { NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";

// GET - Get dashboard statistics for admin
export async function GET() {
  try {
    await DbConnect();

    // Get all barcodes grouped by design
    const designs = await Barcode.aggregate([
      {
        $group: {
          _id: "$design",
          totalItems: { $sum: 1 },
          small: {
            $sum: { $cond: [{ $eq: ["$size", "S"] }, 1, 0] },
          },
          medium: {
            $sum: { $cond: [{ $eq: ["$size", "M"] }, 1, 0] },
          },
          large: {
            $sum: { $cond: [{ $eq: ["$size", "L"] }, 1, 0] },
          },
          // Count by department
          cutting: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Cutting"] }, 1, 0] },
          },
          sewing: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Sewing"] }, 1, 0] },
          },
          quality: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Quality"] }, 1, 0] },
          },
          handmade: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Handmade"] }, 1, 0] },
          },
          addaWork: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Adda Work"] }, 1, 0] },
          },
          patching: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Patching"] }, 1, 0] },
          },
          press: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Press"] }, 1, 0] },
          },
          packing: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Packing"] }, 1, 0] },
          },
          store: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Store"] }, 1, 0] },
          },
          createdAt: { $min: "$createdAt" },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // Get overall stats
    const totalStats = await Barcode.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalDesigns: { $addToSet: "$design" },
          cutting: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Cutting"] }, 1, 0] },
          },
          sewing: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Sewing"] }, 1, 0] },
          },
          quality: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Quality"] }, 1, 0] },
          },
          handmade: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Handmade"] }, 1, 0] },
          },
          addaWork: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Adda Work"] }, 1, 0] },
          },
          patching: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Patching"] }, 1, 0] },
          },
          press: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Press"] }, 1, 0] },
          },
          packing: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Packing"] }, 1, 0] },
          },
          store: {
            $sum: { $cond: [{ $eq: ["$currentDepartment", "Store"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = totalStats[0] || {
      totalItems: 0,
      totalDesigns: [],
      cutting: 0,
      sewing: 0,
      quality: 0,
      handmade: 0,
      addaWork: 0,
      patching: 0,
      press: 0,
      packing: 0,
      store: 0,
    };

    return NextResponse.json({
      success: true,
      stats: {
        totalDesigns: stats.totalDesigns?.length || 0,
        totalItems: stats.totalItems || 0,
        byDepartment: {
          cutting: stats.cutting,
          sewing: stats.sewing,
          quality: stats.quality,
          handmade: stats.handmade,
          addaWork: stats.addaWork,
          patching: stats.patching,
          press: stats.press,
          packing: stats.packing,
          store: stats.store,
        },
      },
      designs: designs.map((d) => ({
        name: d._id,
        totalItems: d.totalItems,
        sizes: {
          small: d.small,
          medium: d.medium,
          large: d.large,
        },
        byDepartment: {
          cutting: d.cutting,
          sewing: d.sewing,
          quality: d.quality,
          handmade: d.handmade,
          addaWork: d.addaWork,
          patching: d.patching,
          press: d.press,
          packing: d.packing,
          store: d.store,
        },
        createdAt: d.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
