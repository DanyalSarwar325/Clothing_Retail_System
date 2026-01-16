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

    // Count scans by this user in this department
    const scanCount = await Barcode.countDocuments({
      "departmentHistory": {
        $elemMatch: {
          department: department,
          scannedBy: userName,
        },
      },
    });

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
