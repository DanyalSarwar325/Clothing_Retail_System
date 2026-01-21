import { NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";

export async function GET() {
  try {
    await DbConnect();

    // Get unique designs
    const designs = await Barcode.distinct("design");

    // Get unique scanners (workers)
    const scanners = await Barcode.aggregate([
      { $unwind: "$departmentHistory" },
      { $match: { "departmentHistory.scannedBy": { $exists: true, $ne: null } } },
      { $group: { _id: "$departmentHistory.scannedBy" } },
      { $sort: { _id: 1 } },
    ]);

    const workers = scanners.map((s) => s._id).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        designs: designs.sort(),
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
