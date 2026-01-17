import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

// GET - Calculate pending payment for a user in a department
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

    // For Cutting department: count only 'scanned' barcodes (confirmed by sewing)
    // For other departments: count all scans by the user in their department
    let scanCount = 0;

    if (department === "Cutting") {
      // Only count barcodes with 'scanned' status that have been scanned by this user
      scanCount = await Barcode.countDocuments({
        status: "scanned",
        "departmentHistory": {
          $elemMatch: {
            department: "Cutting",
            scannedBy: userName,
          },
        },
      });
    } else {
      // For other departments, count scans by user in that department
      scanCount = await Barcode.countDocuments({
        "departmentHistory": {
          $elemMatch: {
            department: department,
            scannedBy: userName,
          },
        },
      });
    }

    const pendingPayment = scanCount * ratePerUnit;

    return NextResponse.json({
      success: true,
      data: {
        userName,
        department,
        scanCount,
        ratePerUnit,
        pendingPayment,
      },
    });
  } catch (error: any) {
    console.error("Error calculating payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to calculate payment" },
      { status: 500 }
    );
  }
}
