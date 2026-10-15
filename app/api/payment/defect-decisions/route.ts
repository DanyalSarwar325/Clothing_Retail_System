import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

function getPieceRateForDept(piece: any, department: string, fallbackRate: number): number {
  const itemRateMatch = piece.departmentRates?.find(
    (r: any) => r.department === department && r.item === piece.item
  );
  if (itemRateMatch && typeof itemRateMatch.ratePerPiece === "number") {
    return itemRateMatch.ratePerPiece;
  }
  const deptRateMatch = piece.departmentRates?.find(
    (r: any) => r.department === department
  );
  if (deptRateMatch && typeof deptRateMatch.ratePerPiece === "number") {
    return deptRateMatch.ratePerPiece;
  }
  return fallbackRate;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filterStatus = searchParams.get("status"); // "pending" | "reviewed" | "all"
    const searchDesign = searchParams.get("design");

    const where: any = {
      status: "defective",
    };

    if (searchDesign) {
      where.design = { contains: searchDesign, mode: "insensitive" };
    }

    const barcodes = await prisma.barcode.findMany({
      where,
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
        defectiveInfo: true,
        qualityCheckLogs: true,
        adminDefectReview: {
          include: {
            departmentReviews: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const rates = await prisma.rate.findMany();
    const rateMap: Record<string, number> = {};
    rates.forEach((r) => {
      rateMap[r.department] = r.ratePerUnit || 0;
    });

    const items = barcodes
      .map((b) => {
        const defectiveInfo = b.defectiveInfo as any;
        const adminDefectReview = b.adminDefectReview as any;
        const isCompanion = !!defectiveInfo?.isCompanionDefect;

        const history = (b.departmentHistory || []).filter(
          (h) => h.department !== "Quality" && h.department !== "Admin"
        );

        const departments = history.map((h) => {
          const dept = h.department;
          const workerName = h.scannedBy || "Worker";
          const rate = getPieceRateForDept(b, dept, rateMap[dept] || 0);
          const previouslyPaid = (b.paidDepartments || []).some(
            (pd) => pd.department === dept
          );

          const existingReview = adminDefectReview?.departmentReviews?.find(
            (r: any) => r.department === dept
          );

          const isCutting = dept === "Cutting";

          let currentDecision: "approved" | "cancelled" | "adjusted" | "pending" = "pending";
          if (isCompanion || isCutting) {
            currentDecision = "approved";
          } else if (existingReview) {
            currentDecision = existingReview.decision;
          }

          return {
            department: dept,
            workerName,
            rate,
            previouslyPaid,
            isCutting,
            isCompanion,
            decision: currentDecision,
          };
        });

        const reviewStatus = isCompanion
          ? "reviewed"
          : adminDefectReview?.status || "pending";

        return {
          _id: b.id,
          id: b.id,
          design: b.design,
          size: b.size,
          item: b.item,
          unitNumber: b.unitNumber,
          barcodeData: b.barcodeData,
          status: b.status,
          defectiveInfo: b.defectiveInfo,
          qualityCheckInfo: b.qualityCheckLogs,
          isCompanionDefect: isCompanion,
          reviewStatus,
          reviewedAt: adminDefectReview?.reviewedAt,
          reviewedBy: adminDefectReview?.reviewedBy,
          adminNotes: adminDefectReview?.notes,
          departments,
        };
      })
      .filter((item) => {
        if (filterStatus === "pending") return item.reviewStatus === "pending";
        if (filterStatus === "reviewed") return item.reviewStatus === "reviewed";
        return true;
      });

    const pendingCount = items.filter((it) => it.reviewStatus === "pending").length;
    const reviewedCount = items.filter((it) => it.reviewStatus === "reviewed").length;

    return NextResponse.json({
      success: true,
      data: {
        items,
        counts: {
          total: items.length,
          pending: pendingCount,
          reviewed: reviewedCount,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching defect decisions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch defect decisions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcodeId, decisions, adminNotes, reviewedBy } = body;

    if (!barcodeId || !Array.isArray(decisions)) {
      return NextResponse.json(
        { success: false, message: "barcodeId and decisions array are required" },
        { status: 400 }
      );
    }

    const barcode = await prisma.barcode.findUnique({
      where: { id: barcodeId },
      include: {
        departmentRates: true,
        paidDepartments: true,
        defectiveInfo: true,
      },
    });

    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    const rates = await prisma.rate.findMany();
    const rateMap: Record<string, number> = {};
    rates.forEach((r) => {
      rateMap[r.department] = r.ratePerUnit || 0;
    });

    const defectiveInfo = barcode.defectiveInfo as any;
    const isCompanion = !!defectiveInfo?.isCompanionDefect;

    const processedReviews = decisions.map((d: any) => {
      const dept = d.department;
      const workerName = d.workerName || "Worker";
      const rate = getPieceRateForDept(barcode, dept, rateMap[dept] || 0);
      const previouslyPaid = (barcode.paidDepartments || []).some(
        (pd) => pd.department === dept
      );

      if (dept === "Cutting" || isCompanion) {
        return {
          department: dept,
          workerName,
          rate,
          previouslyPaid,
          decision: "approved",
          decidedAt: new Date(),
          decidedBy: reviewedBy || "Admin",
          notes: isCompanion ? "Companion scrap auto-approved" : "Cutting master protected",
        };
      }

      let decision: "approved" | "cancelled" | "adjusted" = "approved";
      if (d.approved) {
        decision = "approved";
      } else {
        decision = previouslyPaid ? "adjusted" : "cancelled";
      }

      return {
        department: dept,
        workerName,
        rate,
        previouslyPaid,
        decision,
        decidedAt: new Date(),
        decidedBy: reviewedBy || "Admin",
        notes: d.notes || undefined,
      };
    });

    const existingReview = await prisma.adminDefectReview.findUnique({
      where: { barcodeId },
    });

    let savedReview;
    if (existingReview) {
      await prisma.defectDepartmentReview.deleteMany({
        where: { adminReviewId: existingReview.id },
      });
      savedReview = await prisma.adminDefectReview.update({
        where: { id: existingReview.id },
        data: {
          reviewedAt: new Date(),
          reviewedBy: reviewedBy || "Admin",
          notes: adminNotes || "",
          status: "reviewed",
          departmentReviews: {
            create: processedReviews,
          },
        },
        include: { departmentReviews: true },
      });
    } else {
      savedReview = await prisma.adminDefectReview.create({
        data: {
          barcodeId,
          reviewedAt: new Date(),
          reviewedBy: reviewedBy || "Admin",
          notes: adminNotes || "",
          status: "reviewed",
          departmentReviews: {
            create: processedReviews,
          },
        },
        include: { departmentReviews: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Decision recorded successfully",
      adminDefectReview: savedReview,
    });
  } catch (error: any) {
    console.error("Error saving defect decision:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save defect decision" },
      { status: 500 }
    );
  }
}
