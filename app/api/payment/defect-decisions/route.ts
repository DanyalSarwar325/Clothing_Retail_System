import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode, { Department } from "@/app/libs/models/barcode";
import Rate from "@/app/libs/models/rate";

// Helper to resolve rate for a piece in a given department
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

// GET - Fetch defective barcodes requiring admin review or already reviewed
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const filterStatus = searchParams.get("status"); // "pending" | "reviewed" | "all"
    const searchDesign = searchParams.get("design");

    const query: any = {
      status: "defective",
    };

    if (searchDesign) {
      query.design = { $regex: searchDesign, $options: "i" };
    }

    if (filterStatus === "pending") {
      query.$or = [
        { "adminDefectReview.status": "pending" },
        { adminDefectReview: { $exists: false } },
      ];
    } else if (filterStatus === "reviewed") {
      query["adminDefectReview.status"] = "reviewed";
    }

    const barcodes = await Barcode.find(query).sort({ "defectiveInfo.markedAt": -1 }).lean();

    // Cache fallback rates by department
    const rates = await Rate.find({}).lean();
    const rateMap: Record<string, number> = {};
    rates.forEach((r: any) => {
      rateMap[r.department] = r.ratePerUnit || 0;
    });

    const items = barcodes.map((b: any) => {
      const isCompanion = !!b.defectiveInfo?.isCompanionDefect;
      const history = (b.departmentHistory || []).filter(
        (h: any) => h.department !== "Quality" && h.department !== "Admin"
      );

      // Map departments that worked on this piece
      const departments = history.map((h: any) => {
        const dept = h.department;
        const workerName = h.scannedBy || "Worker";
        const rate = getPieceRateForDept(b, dept, rateMap[dept] || 0);
        const previouslyPaid = (b.paidDepartments || []).some(
          (pd: any) => pd.department === dept
        );

        // Check existing review decision
        const existingReview = b.adminDefectReview?.departmentReviews?.find(
          (r: any) => r.department === dept
        );

        // Cutting is always protected
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
        : b.adminDefectReview?.status || "pending";

      return {
        _id: b._id,
        design: b.design,
        size: b.size,
        item: b.item,
        unitNumber: b.unitNumber,
        barcodeData: b.barcodeData,
        status: b.status,
        defectiveInfo: b.defectiveInfo,
        qualityCheckInfo: b.qualityCheckInfo,
        isCompanionDefect: isCompanion,
        reviewStatus,
        reviewedAt: b.adminDefectReview?.reviewedAt,
        reviewedBy: b.adminDefectReview?.reviewedBy,
        adminNotes: b.adminDefectReview?.notes,
        departments,
      };
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

// POST - Submit admin decision on defective piece departments
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const body = await request.json();
    const { barcodeId, decisions, adminNotes, reviewedBy } = body;

    if (!barcodeId || !Array.isArray(decisions)) {
      return NextResponse.json(
        { success: false, message: "barcodeId and decisions array are required" },
        { status: 400 }
      );
    }

    const barcode = await Barcode.findById(barcodeId);
    if (!barcode) {
      return NextResponse.json(
        { success: false, message: "Barcode not found" },
        { status: 404 }
      );
    }

    const rates = await Rate.find({}).lean();
    const rateMap: Record<string, number> = {};
    rates.forEach((r: any) => {
      rateMap[r.department] = r.ratePerUnit || 0;
    });

    const isCompanion = !!barcode.defectiveInfo?.isCompanionDefect;

    // Process each department decision
    const processedReviews = decisions.map((d: any) => {
      const dept = d.department;
      const workerName = d.workerName || "Worker";
      const rate = getPieceRateForDept(barcode, dept, rateMap[dept] || 0);
      const previouslyPaid = (barcode.paidDepartments || []).some(
        (pd: any) => pd.department === dept
      );

      // Rule: Cutting master and Companion items are ALWAYS approved
      if (dept === "Cutting" || isCompanion) {
        return {
          department: dept as Department,
          workerName,
          rate,
          previouslyPaid,
          decision: "approved" as const,
          decidedAt: new Date(),
          decidedBy: reviewedBy || "Admin",
          notes: isCompanion ? "Companion scrap auto-approved" : "Cutting master protected",
        };
      }

      let decision: "approved" | "cancelled" | "adjusted" = "approved";
      if (d.approved) {
        decision = "approved";
      } else {
        // If unchecked:
        // If already paid, it's an adjustment for the future
        // If unpaid, it's cancelled
        decision = previouslyPaid ? "adjusted" : "cancelled";
      }

      return {
        department: dept as Department,
        workerName,
        rate,
        previouslyPaid,
        decision,
        decidedAt: new Date(),
        decidedBy: reviewedBy || "Admin",
        notes: d.notes || undefined,
      };
    });

    barcode.adminDefectReview = {
      reviewedAt: new Date(),
      reviewedBy: reviewedBy || "Admin",
      notes: adminNotes || "",
      status: "reviewed",
      departmentReviews: processedReviews,
    };

    await barcode.save();

    return NextResponse.json({
      success: true,
      message: "Decision recorded successfully",
      adminDefectReview: barcode.adminDefectReview,
    });
  } catch (error: any) {
    console.error("Error saving defect decision:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to save defect decision" },
      { status: 500 }
    );
  }
}
