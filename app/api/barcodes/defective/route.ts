import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { DEPARTMENTS, Department, DEFECT_REASONS, DefectReason } from "@/app/libs/models/barcode";

// POST - Mark a barcode as defective (Only Quality department can do this)
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { 
      barcodeId, 
      department, 
      markedBy, 
      reason, 
      notes,
      isCompanionDefect,
      defectiveReferenceBarcode,
      companionReason,
    } = body;

    if (!barcodeId) {
      return NextResponse.json(
        { success: false, message: "Barcode ID is required" },
        { status: 400 }
      );
    }

    // Only Quality department can mark items as defective
    if (department !== "Quality") {
      return NextResponse.json(
        { success: false, message: "Only Quality department can mark items as defective" },
        { status: 403 }
      );
    }

    if (!markedBy) {
      return NextResponse.json(
        { success: false, message: "Inspector name (markedBy) is required" },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, message: "Defect reason is required" },
        { status: 400 }
      );
    }

    if (!isCompanionDefect && (!notes || !notes.trim())) {
      return NextResponse.json(
        { success: false, message: "Please provide remarks explaining why the item was marked defective" },
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
    if (barcode.status === "defective" || barcode.status === "damaged") {
      return NextResponse.json(
        { success: false, message: "This barcode is already marked as defective/damaged" },
        { status: 400 }
      );
    }

    // Update barcode status and defectiveInfo
    barcode.status = "defective";
    barcode.currentDepartment = "Quality";
    barcode.scannedAt = new Date();

    barcode.defectiveInfo = {
      markedAt: new Date(),
      markedBy,
      department: "Quality",
      reason: reason.trim(),
      notes: notes?.trim() || (isCompanionDefect ? "Scrapped as companion piece to complete broken suit set" : undefined),
      isCompanionDefect: !!isCompanionDefect,
      defectiveReferenceBarcode: defectiveReferenceBarcode || undefined,
      companionReason: companionReason || undefined,
    };

    // Add Quality to department history if not already present
    if (!barcode.departmentHistory) {
      barcode.departmentHistory = [];
    }
    barcode.departmentHistory.push({
      department: "Quality",
      scannedAt: new Date(),
      scannedBy: markedBy,
    });

    await barcode.save();

    // Determine suit companion items that need to be scrapped together
    const suitType = barcode.suitType || "3pc";
    const fullSuitItems = suitType === "1pc" 
      ? ["Qameez"] 
      : suitType === "2pc" 
      ? ["Qameez", "Shalwar"] 
      : ["Qameez", "Shalwar", "Dupatta"];
    const companionItems = fullSuitItems.filter((it) => it !== barcode.item);

    return NextResponse.json({
      success: true,
      message: isCompanionDefect 
        ? `Companion piece (${barcode.item} - ${barcode.size}) marked as defective` 
        : `Barcode (${barcode.item} - ${barcode.size}) marked as defective`,
      barcode: {
        id: barcode._id,
        design: barcode.design,
        size: barcode.size,
        suitType: barcode.suitType,
        item: barcode.item,
        unitNumber: barcode.unitNumber,
        status: barcode.status,
        defectiveInfo: barcode.defectiveInfo,
      },
      companionInfo: {
        suitType,
        size: barcode.size,
        design: barcode.design,
        companionItemsNeeded: companionItems,
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

    // Build query - include both defective and damaged status
    const query: any = {
      status: { $in: ["defective", "damaged"] },
    };

    if (design) {
      query.design = design;
    }

    if (department && DEPARTMENTS.includes(department as Department)) {
      // Check both defectiveInfo and qualityCheckInfo for department
      query.$or = [
        { "defectiveInfo.department": department },
        { "qualityCheckInfo.department": department }
      ];
    }

    const defectiveBarcodes = await Barcode.find(query)
      .sort({ createdAt: -1 })
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
        // For quality-checked damaged items, use responsiblePerson if available, otherwise use checkedBy
        // For defective items (from defective modal), use markedBy
        const workerName = b.qualityCheckInfo?.responsiblePerson 
          || b.defectiveInfo?.markedBy 
          || b.qualityCheckInfo?.checkedBy 
          || "Unknown";
        
        // Get department from either qualityCheckInfo or defectiveInfo
        const dept = b.qualityCheckInfo?.department 
          || b.defectiveInfo?.department 
          || "Unknown";
        
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
        
        // Get reason from defectiveInfo or notes from qualityCheckInfo
        const reason = b.defectiveInfo?.reason || b.qualityCheckInfo?.notes || "Quality Issue";
        workerStats[workerKey].byReason[reason] = (workerStats[workerKey].byReason[reason] || 0) + 1;

        // Keep last 10 recent defects with full piece info
        if (workerStats[workerKey].recentDefects.length < 10) {
          workerStats[workerKey].recentDefects.push({
            design: b.design,
            item: b.item,
            size: b.size,
            suitType: b.suitType,
            unitNumber: b.unitNumber,
            reason: b.defectiveInfo?.reason || b.qualityCheckInfo?.notes || "Quality Issue",
            markedAt: b.qualityCheckInfo?.checkedAt || b.defectiveInfo?.markedAt,
            markedBy: b.qualityCheckInfo?.checkedBy || b.defectiveInfo?.markedBy,
            responsiblePerson: b.qualityCheckInfo?.responsiblePerson || b.defectiveInfo?.markedBy || "Unknown",
            responsibleDepartment: b.qualityCheckInfo?.department || b.defectiveInfo?.department || "Unknown",
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
          const dept = b.qualityCheckInfo?.department || b.defectiveInfo?.department || "Unknown";
          const reason = b.defectiveInfo?.reason || b.qualityCheckInfo?.notes || "Quality Issue";
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
        qualityCheckInfo: b.qualityCheckInfo,
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
