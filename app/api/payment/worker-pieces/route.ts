import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

export async function GET(request: NextRequest) {
  try {
    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "department is required" },
        { status: 400 }
      );
    }

    const rateDoc = await prisma.rate.findUnique({ where: { department } });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);

    let pieces: any[] = [];

    if (usesFinalStickers) {
      const stickers = await prisma.finalSticker.findMany({
        where: {
          status: { notIn: ["defective", "damaged"] },
          departmentHistory: {
            some: { department },
          },
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
        },
      });

      for (const sticker of stickers) {
        const matchingScans = sticker.departmentHistory.filter((h) => h.department === department);
        for (const scan of matchingScans) {
          if (!scan.scannedBy) continue;

          const isPaid = sticker.paidDepartments.some((pd) => pd.department === department);
          const matchedRate = sticker.departmentRates.find((r) => r.department === department);
          const rate = matchedRate?.ratePerPiece ?? fallbackRate;

          pieces.push({
            _id: sticker.id,
            design: sticker.design,
            item: "Final Sticker",
            size: sticker.size,
            suitType: sticker.suitType,
            unitNumber: sticker.unitNumber,
            workerName: scan.scannedBy,
            scannedAt: scan.scannedAt,
            status: sticker.status,
            isPaid,
            rate,
          });
        }
      }
    } else {
      const barcodes = await prisma.barcode.findMany({
        where: {
          departmentHistory: {
            some: { department },
          },
        },
        include: {
          departmentHistory: true,
          departmentRates: true,
          paidDepartments: true,
          defectiveInfo: true,
          adminDefectReview: {
            include: {
              departmentReviews: true,
            },
          },
        },
      });

      for (const barcode of barcodes) {
        const defectiveInfo = barcode.defectiveInfo as any;
        const adminDefectReview = barcode.adminDefectReview as any;
        const isDefectiveOrDamaged = barcode.status === "defective" || barcode.status === "damaged";
        const isCompanionDefect = !!defectiveInfo?.isCompanionDefect;

        const deptReviews = adminDefectReview?.departmentReviews || [];
        const currentDeptReview = deptReviews.find((dr: any) => dr.department === department);
        const reviewDecision = currentDeptReview?.decision;

        let shouldInclude = false;
        if (!isDefectiveOrDamaged) {
          shouldInclude = true;
        } else if (isCompanionDefect) {
          shouldInclude = true;
        } else if (barcode.status === "defective" && ["approved", "cancelled", "adjusted"].includes(reviewDecision)) {
          shouldInclude = true;
        }

        if (!shouldInclude) continue;

        let defectDecision: string | null = null;
        if (isCompanionDefect) {
          defectDecision = "approved";
        } else if (reviewDecision) {
          defectDecision = reviewDecision;
        }

        const matchingScans = barcode.departmentHistory.filter((h) => h.department === department);
        for (const scan of matchingScans) {
          if (!scan.scannedBy) continue;

          const isPaid = barcode.paidDepartments.some((pd) => pd.department === department);
          const itemRateMatch = barcode.departmentRates.find(
            (r) => r.department === department && r.item === barcode.item
          );
          const deptRateMatch = barcode.departmentRates.find(
            (r) => r.department === department
          );
          const rate = itemRateMatch?.ratePerPiece ?? deptRateMatch?.ratePerPiece ?? fallbackRate;

          pieces.push({
            _id: barcode.id,
            design: barcode.design,
            item: barcode.item,
            size: barcode.size,
            suitType: barcode.suitType,
            unitNumber: barcode.unitNumber,
            workerName: scan.scannedBy,
            scannedAt: scan.scannedAt,
            status: barcode.status,
            defectiveInfo,
            adminDefectReview,
            defectDecision,
            isPaid,
            rate,
          });
        }
      }
    }

    pieces.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

    const workerMap: Record<string, any> = {};

    for (const piece of pieces) {
      const workerName = piece.workerName;
      if (!workerMap[workerName]) {
        workerMap[workerName] = {
          workerName,
          department,
          totalPieces: 0,
          totalPaid: 0,
          totalPending: 0,
          paidAmount: 0,
          pendingAmount: 0,
          totalAdjusted: 0,
          adjustedAmount: 0,
          totalCancelled: 0,
          cancelledAmount: 0,
          designs: {},
          adjustments: [],
          cancelledPieces: [],
        };
      }

      const worker = workerMap[workerName];
      const decision = piece.defectDecision;

      if (decision === "cancelled") {
        worker.totalCancelled++;
        worker.cancelledAmount += piece.rate;
        worker.cancelledPieces.push({
          _id: piece._id,
          design: piece.design,
          item: piece.item,
          size: piece.size,
          unitNumber: piece.unitNumber,
          rate: piece.rate,
          reason: piece.defectiveInfo?.reason || "Cancelled",
          notes: piece.defectiveInfo?.notes || "",
          cancelledAt: piece.adminDefectReview?.reviewedAt || piece.defectiveInfo?.markedAt,
        });
        continue;
      }

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
      }

      worker.totalPieces++;

      if (piece.isPaid) {
        worker.totalPaid++;
        worker.paidAmount += piece.rate;
      } else {
        worker.totalPending++;
        worker.pendingAmount += piece.rate;
      }

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
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          });

          const totalPieces = (d.paidCount || 0) + (d.pendingCount || 0);
          const totalAmount = (d.paidAmount || 0) + (d.pendingAmount || 0);
          const unpaidPieceIds = items.flatMap((it: any) => it.unpaidPieceIds || []);

          return {
            ...d,
            totalPieces,
            totalAmount,
            unpaidPieceIds,
            items,
            itemsBreakdown: items,
          };
        }),
      };
    });

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

export async function POST(request: NextRequest) {
  try {
    const { pieceId, pieceIds, department, paidBy } = await request.json();

    if ((!pieceId && (!pieceIds || !Array.isArray(pieceIds) || pieceIds.length === 0)) || !department) {
      return NextResponse.json(
        { success: false, message: "pieceId or pieceIds, and department are required" },
        { status: 400 }
      );
    }

    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);
    const rateDoc = await prisma.rate.findUnique({ where: { department } });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    const idsToPay: string[] = pieceIds && Array.isArray(pieceIds) ? pieceIds : [pieceId];

    let totalAmountPaid = 0;
    let countPaid = 0;

    if (usesFinalStickers) {
      const stickers = await prisma.finalSticker.findMany({
        where: { id: { in: idsToPay } },
        include: { departmentRates: true, paidDepartments: true },
      });

      for (const sticker of stickers) {
        const alreadyPaid = sticker.paidDepartments.some((pd) => pd.department === department);
        if (!alreadyPaid) {
          const matchedRate = sticker.departmentRates.find((r) => r.department === department);
          const rate = matchedRate?.ratePerPiece ?? fallbackRate;

          try {
            await prisma.finalStickerPayment.create({
              data: {
                finalStickerId: sticker.id,
                department,
                amount: rate,
                paidBy: paidBy || "Admin",
                paidAt: new Date(),
              },
            });
            totalAmountPaid += rate;
            countPaid++;
          } catch {
            // Already paid concurrently
          }
        }
      }
    } else {
      const barcodes = await prisma.barcode.findMany({
        where: { id: { in: idsToPay } },
        include: { departmentRates: true, paidDepartments: true },
      });

      for (const barcode of barcodes) {
        const alreadyPaid = barcode.paidDepartments.some((pd) => pd.department === department);
        if (!alreadyPaid) {
          const itemRateMatch = barcode.departmentRates.find(
            (r) => r.department === department && r.item === barcode.item
          );
          const deptRateMatch = barcode.departmentRates.find(
            (r) => r.department === department
          );
          const rate = itemRateMatch?.ratePerPiece ?? deptRateMatch?.ratePerPiece ?? fallbackRate;

          try {
            await prisma.barcodePayment.create({
              data: {
                barcodeId: barcode.id,
                department,
                amount: rate,
                paidBy: paidBy || "Admin",
                paidAt: new Date(),
              },
            });
            totalAmountPaid += rate;
            countPaid++;
          } catch {
            // Already paid concurrently
          }
        }
      }
    }

    if (!pieceIds || !Array.isArray(pieceIds)) {
      if (countPaid === 0) {
        return NextResponse.json(
          { success: false, message: "This piece is already paid for this department" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Piece marked as paid (₨${totalAmountPaid})`,
        amount: totalAmountPaid,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully marked ${countPaid} pieces as paid (₨${totalAmountPaid.toLocaleString()})`,
      count: countPaid,
      amount: totalAmountPaid,
    });
  } catch (error: any) {
    console.error("Error marking piece as paid:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark piece as paid" },
      { status: 500 }
    );
  }
}
