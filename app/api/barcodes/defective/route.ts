import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { DEPARTMENTS, Department, DEFECT_REASONS, DefectReason } from "@/app/libs/models/barcode";

// POST - Mark a barcode as defective
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeId, department, markedBy, reason, notes } = body;

    if (!barcodeId) {
      return NextResponse.json(
        { success: false, message: "Barcode ID is required" },
        { status: 400 }
      );
    }

    if (!department || !DEPARTMENTS.includes(department as Department)) {
      return NextResponse.json(
        { success: false, message: "Valid department is required" },
        { status: 400 }
      );
    }

    if (!markedBy) {
      return NextResponse.json(
        { success: false, message: "Worker name (markedBy) is required" },
        { status: 400 }
      );
    }

    if (!reason || !DEFECT_REASONS.includes(reason as DefectReason)) {
      return NextResponse.json(
        { success: false, message: "Valid defect reason is required" },
        { status: 400 }
      );
    }

    // Find the barcode
    const barcode = await Barcode.findById(barcodeId);

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    // Check if already marked as defective
    if (barcode.status === "defective" || barcode.status === "wasted") {
      return NextResponse.json(
        { success: false, message: "This barcode is already marked as defective/wasted" },
        { status: 400 }
      );
    }

    // Update barcode status and defectiveInfo
    barcode.status = "defective";
    barcode.defectiveInfo = {
      markedAt: new Date(),
      markedBy,
      department: department as Department,
      reason: reason as DefectReason,
      notes: notes || undefined,
    };

    await barcode.save();

    return NextResponse.json({
      success: true,
      message: `Barcode marked as defective by ${markedBy} in ${department}`,
      barcode: {
        id: barcode._id,
        design: barcode.design,
        size: barcode.size,
        item: barcode.item,
        unitNumber: barcode.unitNumber,
        status: barcode.status,
        defectiveInfo: barcode.defectiveInfo,
      },
    });
  } catch (error: any) {
    console.error("Error marking barcode as defective:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark barcode as defective" },
      { status: 500 }
    );
  }
}

// GET - Get all defective barcodes with optional filters
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const department = searchParams.get("department");
    const groupByWorker = searchParams.get("groupByWorker") === "true";

    // Build query
    const query: any = {
      status: { $in: ["defective", "wasted"] },
    };

    if (design) {
      query.design = design;
    }

    if (department && DEPARTMENTS.includes(department as Department)) {
      query["defectiveInfo.department"] = department;
    }

    const defectiveBarcodes = await Barcode.find(query)
      .sort({ "defectiveInfo.markedAt": -1 })
      .lean();

    // Group by worker if requested
    if (groupByWorker) {
      const workerStats: Record<string, {
        name: string;
        department: string;
        totalDefective: number;
        byDesign: Record<string, number>;
        byReason: Record<string, number>;
        recentDefects: any[];
      }> = {};

      defectiveBarcodes.forEach((b: any) => {
        const workerName = b.defectiveInfo?.markedBy || "Unknown";
        const dept = b.defectiveInfo?.department || "Unknown";
        const workerKey = `${workerName}-${dept}`;

        if (!workerStats[workerKey]) {
          workerStats[workerKey] = {
            name: workerName,
            department: dept,
            totalDefective: 0,
            byDesign: {},
            byReason: {},
            recentDefects: [],
          };
        }

        workerStats[workerKey].totalDefective++;
        workerStats[workerKey].byDesign[b.design] = (workerStats[workerKey].byDesign[b.design] || 0) + 1;
        
        const reason = b.defectiveInfo?.reason || "Unknown";
        workerStats[workerKey].byReason[reason] = (workerStats[workerKey].byReason[reason] || 0) + 1;

        // Keep last 5 recent defects
        if (workerStats[workerKey].recentDefects.length < 5) {
          workerStats[workerKey].recentDefects.push({
            design: b.design,
            item: b.item,
            reason: b.defectiveInfo?.reason,
            markedAt: b.defectiveInfo?.markedAt,
          });
        }
      });

      // Convert to array and sort by total defective count
      const workerReport = Object.values(workerStats).sort((a, b) => b.totalDefective - a.totalDefective);

      return NextResponse.json({
        success: true,
        count: defectiveBarcodes.length,
        workerReport,
      });
    }

    // Group by design for summary
    const summaryByDesign: Record<string, {
      total: number;
      defective: number;
      byDepartment: Record<string, number>;
      byReason: Record<string, number>;
    }> = {};

    // Get total generated for each design
    const allDesigns = [...new Set(defectiveBarcodes.map((b: any) => b.design))];
    
    for (const designName of allDesigns) {
      const totalGenerated = await Barcode.countDocuments({ design: designName });
      const defectiveCount = defectiveBarcodes.filter((b: any) => b.design === designName).length;
      
      const byDepartment: Record<string, number> = {};
      const byReason: Record<string, number> = {};
      
      defectiveBarcodes
        .filter((b: any) => b.design === designName)
        .forEach((b: any) => {
          const dept = b.defectiveInfo?.department || "Unknown";
          const reason = b.defectiveInfo?.reason || "Unknown";
          byDepartment[dept] = (byDepartment[dept] || 0) + 1;
          byReason[reason] = (byReason[reason] || 0) + 1;
        });

      summaryByDesign[designName] = {
        total: totalGenerated,
        defective: defectiveCount,
        byDepartment,
        byReason,
      };
    }

    return NextResponse.json({
      success: true,
      count: defectiveBarcodes.length,
      summary: summaryByDesign,
      barcodes: defectiveBarcodes.map((b: any) => ({
        id: b._id,
        design: b.design,
        size: b.size,
        suitType: b.suitType,
        item: b.item,
        unitNumber: b.unitNumber,
        status: b.status,
        defectiveInfo: b.defectiveInfo,
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching defective barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch defective barcodes" },
      { status: 500 }
    );
  }
}
