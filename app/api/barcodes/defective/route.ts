import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
export const DEPARTMENTS = [
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
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// POST - Mark a barcode as defective (Only Quality department can do this)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      barcodeId,
      barcodeData,
      department,
      markedBy,
      reason,
      notes,
      isCompanionDefect,
      convertedFromOk,
      defectiveReferenceBarcode,
      companionReason,
    } = body;

    if (!barcodeId && !barcodeData) {
      return NextResponse.json(
        { success: false, message: "Barcode ID or barcode data is required" },
        { status: 400 }
      );
    }

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

    const isCompanion = !!isCompanionDefect || !!convertedFromOk;
    const finalReason =
      reason?.trim() || (isCompanion ? "Converted from OK (Companion)" : "Quality Defect");
    const finalNotes =
      notes?.trim() ||
      (isCompanion
        ? "Converted from OK by quality inspector to complete broken suit companion"
        : "Marked defective during quality inspection");

    // Find the barcode by ID or unique barcodeData
    const cleanData = barcodeData ? barcodeData.trim() : "";
    const whereClause: any = barcodeId ? { id: barcodeId } : { barcodeData: cleanData };
    let barcode = await prisma.barcode.findUnique({
      where: whereClause,
      include: {
        departmentHistory: true,
        paidDepartments: true,
      },
    });

    if (!barcode && cleanData) {
      barcode = await prisma.barcode.findFirst({
        where: {
          OR: [
            { id: cleanData },
            { barcodeData: { equals: cleanData, mode: "insensitive" } },
          ],
        },
        include: {
          departmentHistory: true,
          paidDepartments: true,
        },
      });
    }

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found in database" },
        { status: 404 }
      );
    }

    if (!isCompanion && (barcode.status === "defective" || barcode.status === "damaged")) {
      return NextResponse.json(
        {
          success: false,
          message: `This item (${barcode.design} - ${barcode.item}) is already marked as defective and cannot be scanned twice.`,
          alreadyDefective: true,
          barcode: {
            id: barcode.id,
            design: barcode.design,
            item: barcode.item,
            size: barcode.size,
            unitNumber: barcode.unitNumber,
            status: barcode.status,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Automatically detect suitType for this design:
    let suitType = barcode.suitType || "2pc";
    if (suitType !== "1pc") {
      const hasDupatta = await prisma.barcode.findFirst({
        where: { design: barcode.design, item: "Dupatta" },
      });
      suitType = hasDupatta ? "3pc" : "2pc";
    }

    let updatedBarcode: any = null;
    let defectInfoData: any = null;

    await prisma.$transaction(async (tx) => {
      // 1. Record / upsert defect info
      defectInfoData = {
        department: "Quality",
        markedBy,
        reason: finalReason,
        notes: finalNotes,
        isCompanionDefect: isCompanion,
        defectiveReferenceBarcode: defectiveReferenceBarcode || null,
        companionReason: companionReason || null,
        markedAt: now,
      };

      await tx.barcodeDefect.upsert({
        where: { barcodeId: barcode.id },
        create: {
          barcodeId: barcode.id,
          ...defectInfoData,
        },
        update: {
          ...defectInfoData,
        },
      });

      // 2. Add quality check audit log
      await tx.qualityCheckLog.create({
        data: {
          barcodeId: barcode.id,
          status: "defective",
          checkedBy: markedBy,
          department: "Quality",
          notes: defectInfoData.notes,
          checkedAt: now,
        },
      });

      // 3. Add Quality to department scan history
      await tx.barcodeScan.create({
        data: {
          barcodeId: barcode.id,
          department: "Quality",
          scannedAt: now,
          scannedBy: markedBy,
        },
      });

      // 4. Handle Admin defect review (auto-approve companion/converted pieces so stitcher gets paid)
      if (isCompanion) {
        const adminReview = await tx.adminDefectReview.upsert({
          where: { barcodeId: barcode.id },
          create: {
            barcodeId: barcode.id,
            reviewedAt: now,
            reviewedBy: "System (Companion Protection)",
            notes: "Suit companion piece scrapped to complete broken suit. All workers receive full payment.",
            status: "reviewed",
          },
          update: {
            reviewedAt: now,
            reviewedBy: "System (Companion Protection)",
            notes: "Suit companion piece scrapped to complete broken suit. All workers receive full payment.",
            status: "reviewed",
          },
        });

        // Add reviews for previous departments
        const deptsToReview = (barcode.departmentHistory || []).filter(
          (h) => h.department !== "Quality" && h.department !== "Admin"
        );

        for (const h of deptsToReview) {
          const previouslyPaid = barcode.paidDepartments.some((pd) => pd.department === h.department);
          await tx.defectDepartmentReview.create({
            data: {
              adminReviewId: adminReview.id,
              department: h.department,
              workerName: h.scannedBy || "Worker",
              rate: 0,
              previouslyPaid,
              decision: "approved",
              decidedAt: now,
              decidedBy: "System",
              notes: "Companion piece auto-approved",
            },
          });
        }
      } else {
        await tx.adminDefectReview.upsert({
          where: { barcodeId: barcode.id },
          create: {
            barcodeId: barcode.id,
            reviewedAt: now,
            reviewedBy: "Pending Admin Review",
            notes: notes?.trim() || "",
            status: "pending",
          },
          update: {
            reviewedAt: now,
            reviewedBy: "Pending Admin Review",
            notes: notes?.trim() || "",
            status: "pending",
          },
        });
      }

      // 5. Update master barcode status
      updatedBarcode = await tx.barcode.update({
        where: { id: barcode.id },
        data: {
          status: "defective",
          currentDepartment: "Quality",
          scannedAt: now,
          suitType,
        },
      });
    });

    const fullSuitItems =
      suitType === "1pc"
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
        id: updatedBarcode.id,
        _id: updatedBarcode.id,
        design: updatedBarcode.design,
        size: updatedBarcode.size,
        suitType: updatedBarcode.suitType,
        item: updatedBarcode.item,
        unitNumber: updatedBarcode.unitNumber,
        status: updatedBarcode.status,
        defectiveInfo: defectInfoData,
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
    const { searchParams } = new URL(request.url);
    const design = searchParams.get("design");
    const department = searchParams.get("department");
    const groupByWorker = searchParams.get("groupByWorker") === "true";

    const where: any = {
      status: { in: ["defective", "damaged"] },
    };

    if (design) {
      where.design = design;
    }

    if (department && DEPARTMENTS.includes(department as Department)) {
      where.OR = [
        { defectiveInfo: { department } },
        { qualityCheckLogs: { some: { department } } },
      ];
    }

    const defectiveBarcodes = await prisma.barcode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        defectiveInfo: true,
        qualityCheckLogs: {
          orderBy: { checkedAt: "desc" },
          take: 1,
        },
      },
    });

    if (groupByWorker) {
      const workerStats: Record<string, {
        name: string;
        department: string;
        totalDefective: number;
        byDesign: Record<string, number>;
        byReason: Record<string, number>;
        recentDefects: any[];
      }> = {};

      defectiveBarcodes.forEach((b) => {
        const latestQualityLog = b.qualityCheckLogs[0];
        const workerName =
          latestQualityLog?.responsiblePerson ||
          b.defectiveInfo?.markedBy ||
          latestQualityLog?.checkedBy ||
          "Unknown";

        const dept =
          latestQualityLog?.department ||
          b.defectiveInfo?.department ||
          "Unknown";

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
        workerStats[workerKey].byDesign[b.design] =
          (workerStats[workerKey].byDesign[b.design] || 0) + 1;

        const reason = b.defectiveInfo?.reason || latestQualityLog?.notes || "Quality Issue";
        workerStats[workerKey].byReason[reason] =
          (workerStats[workerKey].byReason[reason] || 0) + 1;

        if (workerStats[workerKey].recentDefects.length < 10) {
          workerStats[workerKey].recentDefects.push({
            design: b.design,
            item: b.item,
            size: b.size,
            suitType: b.suitType,
            unitNumber: b.unitNumber,
            reason,
            markedAt: latestQualityLog?.checkedAt || b.defectiveInfo?.markedAt,
            markedBy: latestQualityLog?.checkedBy || b.defectiveInfo?.markedBy,
            responsiblePerson: latestQualityLog?.responsiblePerson || b.defectiveInfo?.markedBy || "Unknown",
            responsibleDepartment: latestQualityLog?.department || b.defectiveInfo?.department || "Unknown",
          });
        }
      });

      const workerReport = Object.values(workerStats).sort(
        (a, b) => b.totalDefective - a.totalDefective
      );

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

    const allDesigns = [...new Set(defectiveBarcodes.map((b) => b.design))];

    for (const designName of allDesigns) {
      const totalGenerated = await prisma.barcode.count({ where: { design: designName } });
      const designDefects = defectiveBarcodes.filter((b) => b.design === designName);

      const byDepartment: Record<string, number> = {};
      const byReason: Record<string, number> = {};

      designDefects.forEach((b) => {
        const latestQualityLog = b.qualityCheckLogs[0];
        const dept = latestQualityLog?.department || b.defectiveInfo?.department || "Unknown";
        const reason = b.defectiveInfo?.reason || latestQualityLog?.notes || "Quality Issue";
        byDepartment[dept] = (byDepartment[dept] || 0) + 1;
        byReason[reason] = (byReason[reason] || 0) + 1;
      });

      summaryByDesign[designName] = {
        total: totalGenerated,
        defective: designDefects.length,
        byDepartment,
        byReason,
      };
    }

    return NextResponse.json({
      success: true,
      count: defectiveBarcodes.length,
      summary: summaryByDesign,
      barcodes: defectiveBarcodes.map((b) => {
        const latestQualityLog = b.qualityCheckLogs[0];
        return {
          id: b.id,
          _id: b.id,
          design: b.design,
          size: b.size,
          suitType: b.suitType,
          item: b.item,
          unitNumber: b.unitNumber,
          status: b.status,
          defectiveInfo: b.defectiveInfo,
          qualityCheckInfo: latestQualityLog
            ? {
                checkedAt: latestQualityLog.checkedAt,
                checkedBy: latestQualityLog.checkedBy,
                status: latestQualityLog.status,
                department: latestQualityLog.department || undefined,
                responsiblePerson: latestQualityLog.responsiblePerson || undefined,
                notes: latestQualityLog.notes || undefined,
              }
            : undefined,
          createdAt: b.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error("Error fetching defective barcodes:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch defective barcodes" },
      { status: 500 }
    );
  }
}
