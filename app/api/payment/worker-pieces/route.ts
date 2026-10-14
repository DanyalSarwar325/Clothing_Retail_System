import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Rate from "@/app/libs/models/rate";

// Departments that use final stickers
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

// GET - Get all pieces for workers in a department grouped by worker and design
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "department is required" },
        { status: 400 }
      );
    }

    // Auto-sync existing records for Cutting
    if (department === "Cutting") {
      await Barcode.updateMany(
        {
          "departmentHistory.department": { $ne: "Cutting" },
          status: { $nin: ["defective", "damaged"] },
        },
        {
          $push: {
            departmentHistory: {
              department: "Cutting",
              scannedAt: new Date(),
              scannedBy: "Cutting Master",
            },
          },
        }
      );
    }

    // Auto-sync existing quality_ok records for Overlock & Clipping
    if (department === "Overlock" || department === "Clipping") {
      await Barcode.updateMany(
        {
          $or: [
            { "qualityCheckInfo.status": "quality_ok" },
            { "departmentHistory.department": "Quality" },
          ],
          "departmentHistory.department": { $ne: "Overlock" },
          status: { $nin: ["defective", "damaged"] },
        },
        {
          $push: {
            departmentHistory: {
              department: "Overlock",
              scannedAt: new Date(),
              scannedBy: "Overlock",
            },
          },
        }
      );

      await Barcode.updateMany(
        {
          $or: [
            { "qualityCheckInfo.status": "quality_ok" },
            { "departmentHistory.department": "Quality" },
          ],
          "departmentHistory.department": { $ne: "Clipping" },
          status: { $nin: ["defective", "damaged"] },
        },
        {
          $push: {
            departmentHistory: {
              department: "Clipping",
              scannedAt: new Date(),
              scannedBy: "Clipping",
            },
          },
        }
      );
    }

    // Get fallback rate for this department
    const rateDoc = await Rate.findOne({ department });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Check if this department uses final stickers
    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);

    let pieces: any[] = [];

    if (usesFinalStickers) {
      // Query FinalSticker collection for Packing/Store
      pieces = await FinalSticker.aggregate([
        {
          $match: {
            "departmentHistory.department": department,
            status: { $nin: ["defective", "damaged"] },
          },
        },
        { $unwind: "$departmentHistory" },
        { $match: { "departmentHistory.department": department } },
        {
          $project: {
            _id: 1,
            design: 1,
            item: { $literal: "Final Sticker" },
            size: 1,
            suitType: 1,
            unitNumber: 1,
            workerName: "$departmentHistory.scannedBy",
            scannedAt: "$departmentHistory.scannedAt",
            departmentRates: 1,
            paidDepartments: 1,
            status: 1,
            isPaid: {
              $cond: [
                { $isArray: "$paidDepartments" },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$paidDepartments",
                          as: "pd",
                          cond: { $eq: ["$$pd.department", department] },
                        },
                      },
                    },
                    0,
                  ],
                },
                false,
              ],
            },
            rate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: { $eq: ["$$r.department", department] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] },
              },
            },
          },
        },
        { $match: { workerName: { $ne: null } } },
        { $sort: { scannedAt: -1 } },
      ]);
    } else {
      // For garment piece departments:
      // Match active pieces, companion defect pieces, or defective pieces reviewed by admin
      pieces = await Barcode.aggregate([
        {
          $match: {
            "departmentHistory.department": department,
            $or: [
              { status: { $nin: ["defective", "damaged"] } },
              { "defectiveInfo.isCompanionDefect": true },
              {
                status: "defective",
                "adminDefectReview.departmentReviews": {
                  $elemMatch: {
                    department: department,
                    decision: { $in: ["approved", "cancelled", "adjusted"] },
                  },
                },
              },
            ],
          },
        },
        { $unwind: "$departmentHistory" },
        { $match: { "departmentHistory.department": department } },
        {
          $project: {
            _id: 1,
            design: 1,
            item: 1,
            size: 1,
            suitType: 1,
            unitNumber: 1,
            workerName: "$departmentHistory.scannedBy",
            scannedAt: "$departmentHistory.scannedAt",
            departmentRates: 1,
            paidDepartments: 1,
            status: 1,
            defectiveInfo: 1,
            adminDefectReview: 1,
            defectDecision: {
              $let: {
                vars: {
                  rev: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$adminDefectReview.departmentReviews", []] },
                          as: "dr",
                          cond: { $eq: ["$$dr.department", department] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $eq: ["$defectiveInfo.isCompanionDefect", true] },
                    "approved",
                    {
                      $cond: [
                        { $ne: ["$status", "defective"] },
                        "approved",
                        { $ifNull: ["$$rev.decision", "pending"] },
                      ],
                    },
                  ],
                },
              },
            },
            isPaid: {
              $cond: [
                { $isArray: "$paidDepartments" },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$paidDepartments",
                          as: "pd",
                          cond: { $eq: ["$$pd.department", department] },
                        },
                      },
                    },
                    0,
                  ],
                },
                false,
              ],
            },
            rate: {
              $let: {
                vars: {
                  itemRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: {
                            $and: [
                              { $eq: ["$$r.department", department] },
                              { $eq: ["$$r.item", "$item"] },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                  deptRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: { $eq: ["$$r.department", department] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  $ifNull: [
                    "$$itemRate.ratePerPiece",
                    { $ifNull: ["$$deptRate.ratePerPiece", fallbackRate] },
                  ],
                },
              },
            },
          },
        },
        { $match: { workerName: { $ne: null } } },
        { $sort: { scannedAt: -1 } },
      ]);
    }

    // Group pieces by worker
    const workerMap: Record<string, any> = {};

    for (const piece of pieces) {
      const workerName = piece.workerName;

      if (!workerMap[workerName]) {
        workerMap[workerName] = {
          workerName,
          totalPieces: 0,
          totalPaid: 0,
          totalPending: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalAdjusted: 0,
          adjustedAmount: 0,
          adjustments: [],
          totalCancelled: 0,
          cancelledAmount: 0,
          cancelled: [],
          designs: {},
        };
      }

      const worker = workerMap[workerName];
      const decision = piece.defectDecision || "approved";

      // Case 1: Cancelled by Admin (unpaid piece cancelled due to defect)
      if (decision === "cancelled") {
        worker.totalCancelled++;
        worker.cancelledAmount += piece.rate;
        worker.cancelled.push({
          _id: piece._id,
          design: piece.design,
          item: piece.item,
          size: piece.size,
          unitNumber: piece.unitNumber,
          rate: piece.rate,
          reason: piece.defectiveInfo?.reason || "Defect",
          notes: piece.defectiveInfo?.notes || "",
          decidedAt: piece.adminDefectReview?.reviewedAt || piece.defectiveInfo?.markedAt,
        });
        continue; // Exclude from normal active pieces
      }

      // Case 2: Adjusted by Admin (piece was already paid, so deduction applies to future payout)
      if (decision === "adjusted") {
        worker.totalAdjusted++;
        worker.adjustedAmount += piece.rate;
        worker.adjustments.push({
          _id: piece._id,
          design: piece.design,
          item: piece.item,
          size: piece.size,
          unitNumber: piece.unitNumber,
          rate: piece.rate,
          reason: piece.defectiveInfo?.reason || "Defect",
          notes: piece.defectiveInfo?.notes || "",
          decidedAt: piece.adminDefectReview?.reviewedAt || piece.defectiveInfo?.markedAt,
        });
        // Still marked as paid in history, but deducted from future pending earnings
      }

      // Normal active / approved pieces
      worker.totalPieces++;

      if (piece.isPaid) {
        worker.totalPaid++;
        worker.paidAmount += piece.rate;
      } else {
        worker.totalPending++;
        worker.pendingAmount += piece.rate;
      }

      // Group by design
      if (!worker.designs[piece.design]) {
        worker.designs[piece.design] = {
          design: piece.design,
          pieces: [],
          paidCount: 0,
          pendingCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          itemsBreakdown: {},
        };
      }

      const designGroup = worker.designs[piece.design];
      designGroup.pieces.push({
        _id: piece._id,
        item: piece.item,
        size: piece.size,
        unitNumber: piece.unitNumber,
        rate: piece.rate,
        isPaid: piece.isPaid,
        scannedAt: piece.scannedAt,
        isAdjusted: decision === "adjusted",
      });

      if (piece.isPaid) {
        designGroup.paidCount++;
        designGroup.paidAmount += piece.rate;
      } else {
        designGroup.pendingCount++;
        designGroup.pendingAmount += piece.rate;
      }

      // Breakdown by item type (Shalwar, Qameez, Dupatta)
      const itemKey = piece.item || "Other";
      if (!designGroup.itemsBreakdown[itemKey]) {
        designGroup.itemsBreakdown[itemKey] = {
          item: itemKey,
          count: 0,
          rate: piece.rate,
          totalAmount: 0,
          paidCount: 0,
          paidAmount: 0,
          pendingCount: 0,
          pendingAmount: 0,
          pieceIds: [],
          unpaidPieceIds: [],
        };
      }

      const it = designGroup.itemsBreakdown[itemKey];
      it.count++;
      it.rate = piece.rate;
      it.totalAmount += piece.rate;
      it.pieceIds.push(piece._id);

      if (piece.isPaid) {
        it.paidCount++;
        it.paidAmount += piece.rate;
      } else {
        it.pendingCount++;
        it.pendingAmount += piece.rate;
        it.unpaidPieceIds.push(piece._id);
      }
    }

    // Convert to array format with sorted item breakdowns and net pending
    const itemOrder = ["Qameez", "Shalwar", "Dupatta", "Final Sticker"];
    const workers = Object.values(workerMap).map((worker: any) => {
      const netPendingAmount = Math.max(0, worker.pendingAmount - worker.adjustedAmount);

      return {
        ...worker,
        netPendingAmount,
        designs: Object.values(worker.designs).map((d: any) => {
          const items = Object.values(d.itemsBreakdown).sort((a: any, b: any) => {
            const idxA = itemOrder.indexOf(a.item);
            const idxB = itemOrder.indexOf(b.item);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.item.localeCompare(b.item);
          });

          const allUnpaidPieceIds = d.pieces
            .filter((p: any) => !p.isPaid)
            .map((p: any) => p._id);

          return {
            design: d.design,
            totalPieces: d.pieces.length,
            totalAmount: d.paidAmount + d.pendingAmount,
            paidCount: d.paidCount,
            paidAmount: d.paidAmount,
            pendingCount: d.pendingCount,
            pendingAmount: d.pendingAmount,
            items,
            pieces: d.pieces,
            unpaidPieceIds: allUnpaidPieceIds,
          };
        }),
      };
    });

    // Sort workers by pending amount (highest first)
    workers.sort((a: any, b: any) => b.netPendingAmount - a.netPendingAmount);

    const totalAdjustedSum = workers.reduce((sum: number, w: any) => sum + w.adjustedAmount, 0);
    const totalCancelledSum = workers.reduce((sum: number, w: any) => sum + w.cancelledAmount, 0);
    const grossPendingSum = workers.reduce((sum: number, w: any) => sum + w.pendingAmount, 0);
    const netPendingSum = Math.max(0, grossPendingSum - totalAdjustedSum);

    return NextResponse.json({
      success: true,
      data: {
        department,
        fallbackRate,
        workers,
        totals: {
          totalWorkers: workers.length,
          totalPieces: workers.reduce((sum: number, w: any) => sum + w.totalPieces, 0),
          totalPaid: workers.reduce((sum: number, w: any) => sum + w.totalPaid, 0),
          totalPending: workers.reduce((sum: number, w: any) => sum + w.totalPending, 0),
          paidAmount: workers.reduce((sum: number, w: any) => sum + w.paidAmount, 0),
          pendingAmount: grossPendingSum,
          totalAdjusted: workers.reduce((sum: number, w: any) => sum + w.totalAdjusted, 0),
          adjustedAmount: totalAdjustedSum,
          totalCancelled: workers.reduce((sum: number, w: any) => sum + w.totalCancelled, 0),
          cancelledAmount: totalCancelledSum,
          netPendingAmount: netPendingSum,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching worker pieces:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch worker pieces" },
      { status: 500 }
    );
  }
}

// POST - Mark a piece or batch of pieces as paid for a department
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const { pieceId, pieceIds, department, paidBy } = await request.json();

    if ((!pieceId && (!pieceIds || !Array.isArray(pieceIds) || pieceIds.length === 0)) || !department) {
      return NextResponse.json(
        { success: false, message: "pieceId or pieceIds, and department are required" },
        { status: 400 }
      );
    }

    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);
    const Model = usesFinalStickers ? FinalSticker : Barcode;

    const rateDoc = await Rate.findOne({ department });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Helper to resolve rate for a piece
    const getPieceRate = (piece: any) => {
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
    };

    // Batch payment
    if (Array.isArray(pieceIds) && pieceIds.length > 0) {
      const targetPieces = await Model.find({ _id: { $in: pieceIds } });
      let totalAmountPaid = 0;
      let countPaid = 0;

      for (const piece of targetPieces) {
        const alreadyPaid = piece.paidDepartments?.some((pd: any) => pd.department === department);
        if (!alreadyPaid) {
          const rate = getPieceRate(piece);
          await Model.findByIdAndUpdate(piece._id, {
            $push: {
              paidDepartments: {
                department,
                paidAt: new Date(),
                paidBy: paidBy || "Admin",
                amount: rate,
              },
            },
          });
          totalAmountPaid += rate;
          countPaid++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully marked ${countPaid} pieces as paid (₨${totalAmountPaid.toLocaleString()})`,
        count: countPaid,
        amount: totalAmountPaid,
      });
    }

    // Single piece payment
    const piece = await Model.findById(pieceId);
    if (!piece) {
      return NextResponse.json(
        { success: false, message: "Piece not found" },
        { status: 404 }
      );
    }

    const alreadyPaid = piece.paidDepartments?.some((pd: any) => pd.department === department);
    if (alreadyPaid) {
      return NextResponse.json(
        { success: false, message: "This piece is already paid for this department" },
        { status: 400 }
      );
    }

    const rate = getPieceRate(piece);

    await Model.findByIdAndUpdate(pieceId, {
      $push: {
        paidDepartments: {
          department,
          paidAt: new Date(),
          paidBy: paidBy || "Admin",
          amount: rate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Piece marked as paid (₨${rate})`,
      amount: rate,
    });
  } catch (error: any) {
    console.error("Error marking piece as paid:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark piece as paid" },
      { status: 500 }
    );
  }
}
