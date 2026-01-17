import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

// GET - Pending payment per design for a user in a department
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const userName = searchParams.get("userName");
    const department = searchParams.get("department");

    if (!userName || !department) {
      return NextResponse.json(
        { success: false, message: "userName and department are required" },
        { status: 400 }
      );
    }

    // Get rate for department
    const rate = await Rate.findOne({ department });
    const ratePerUnit = rate?.ratePerUnit || 0;

    // Aggregate scans per design for this user & department
    // For Cutting department: only count 'scanned' barcodes (confirmed by sewing)
    // For other departments: count all scans
    const matchStage: any = {
      "departmentHistory.department": department,
      "departmentHistory.scannedBy": userName,
    };

    if (department === "Cutting") {
      matchStage.status = "scanned";
    }

    const results = await Barcode.aggregate([
      { $unwind: "$departmentHistory" },
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: "$design",
          scanCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const perDesign = results.map((row) => ({
      design: row._id as string,
      scanCount: row.scanCount as number,
      ratePerUnit,
      pendingPayment: (row.scanCount as number) * ratePerUnit,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        ratePerUnit,
        perDesign,
      },
    });
  } catch (error: any) {
    console.error("Error calculating payment by design:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to calculate payment" },
      { status: 500 }
    );
  }
}
