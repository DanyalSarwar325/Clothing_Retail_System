import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getActiveFinancialYear, VoucherType } from "@/app/libs/accounting/postingService";
import { generateSequenceNumber } from "@/app/libs/accounting/voucherNumberService";
import { getSession } from "@/app/libs/auth";
import { ensureAccountingSeeded } from "@/app/libs/accounting/seedAccounting";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");

    const workerParties = await prisma.party.findMany({
      where: { type: "worker", status: "active" },
      orderBy: { name: "asc" },
    });

    const enrichedWorkers = workerParties.map((w) => ({
      ...w,
      _id: w.id,
      advanceBalance: 0,
    }));

    let departmentData = null;
    if (department) {
      try {
        const origin = request.nextUrl.origin;
        const res = await fetch(
          `${origin}/api/payment/worker-pieces?department=${encodeURIComponent(department)}`
        );
        const data = await res.json();
        if (data.success) {
          departmentData = data.data;
        }
      } catch (err) {
        console.error("Failed to fetch department payment data:", err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        workers: enrichedWorkers,
        departmentData,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureAccountingSeeded();
    const fy = await getActiveFinancialYear();

    let validUserId = session.id;
    const userInDb = await prisma.user.findUnique({ where: { id: session.id } });
    if (!userInDb) {
      const fallbackUser =
        (await prisma.user.findFirst({ where: { role: "admin" } })) ||
        (await prisma.user.findFirst());
      if (fallbackUser) {
        validUserId = fallbackUser.id;
      }
    }

    const body = await request.json();
    const {
      action,
      workerName,
      workerId,
      department,
      design,
      amount,
      paidFromAccountId,
      paymentMode,
      reference,
      referenceNumber,
    } = body;

    const targetDesign = design && design !== "all" ? design.trim() : null;
    const ref = (reference || referenceNumber || "").trim() || null;

    let workerParty: any = null;
    if (workerId) {
      workerParty = await prisma.party.findUnique({ where: { id: workerId } });
    }
    if (!workerParty && workerName) {
      const normalized = workerName.trim().toLowerCase();
      workerParty = await prisma.party.findFirst({
        where: { normalizedName: normalized, type: "worker" },
      });
      if (!workerParty) {
        workerParty = await prisma.party.create({
          data: {
            name: workerName.trim(),
            normalizedName: normalized,
            type: "worker",
            notes: `Factory Worker (${department || "General"})`,
            status: "active",
            createdById: validUserId,
          },
        });
      }
    }

    if (!workerParty) {
      return NextResponse.json({ success: false, error: "Worker not specified" }, { status: 400 });
    }

    let paidFromAccount = paidFromAccountId
      ? await prisma.account.findUnique({ where: { id: paidFromAccountId } })
      : null;
    if (!paidFromAccount) {
      paidFromAccount = await prisma.account.findFirst({
        where: { rootType: "asset", status: "active", accountRole: "cash" },
      });
      if (!paidFromAccount) {
        paidFromAccount = await prisma.account.findFirst({
          where: { rootType: "asset", status: "active" },
        });
      }
      if (!paidFromAccount) {
        paidFromAccount = await prisma.account.create({
          data: {
            code: "AS-CASH",
            title: "Cash in Hand",
            rootType: "asset",
            accountRole: "cash",
            description: "Default physical cash account",
            status: "active",
          },
        });
      }
    }

    if (action === "give_advance") {
      return NextResponse.json(
        { success: false, error: "Worker advances (Peshgi) are disabled by policy." },
        { status: 400 }
      );
    }

    if (action === "pay_wages") {
      const wageAmount = Number(amount);

      if (isNaN(wageAmount) || wageAmount < 0) {
        return NextResponse.json({ success: false, error: "Invalid wage calculation" }, { status: 400 });
      }

      // Pre-check & gather unpaid pieces before opening transaction to optimize execution time
      const nameToMatch = department === "Cutting" ? "Cutting Master" : (workerName?.trim() || workerParty.name);

      const rateDoc = await prisma.rate.findUnique({ where: { department: department || "" } });
      const fallbackRate = rateDoc?.ratePerUnit || 0;

      let logIds: string[] = [];
      let cuttingPayments: any[] = [];
      let stickerPayments: any[] = [];
      let barcodePayments: any[] = [];

      if (department === "Cutting") {
        const matchingLogs = await prisma.pOReceivingLog.findMany({
          where: {
            ...(targetDesign ? { po: { design: { equals: targetDesign, mode: "insensitive" } } } : {}),
            items: { some: { isPaid: false } },
          },
          select: { id: true },
        });
        logIds = matchingLogs.map((l) => l.id);

        const cuttingBarcodes = await prisma.barcode.findMany({
          where: {
            ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
            departmentHistory: {
              some: {
                department: "Cutting",
                scannedBy: { equals: nameToMatch, mode: "insensitive" },
              },
            },
            paidDepartments: {
              none: { department: "Cutting" },
            },
          },
          include: {
            departmentRates: { where: { department: "Cutting" } },
            defectiveInfo: true,
            adminDefectReview: {
              include: {
                departmentReviews: { where: { department: "Cutting" } },
              },
            },
          },
        });

        // Filter out barcodes where cutting was rejected/cancelled by admin (withheld for defect)
        const eligibleCuttingBarcodes = cuttingBarcodes.filter((cb) => {
          if (cb.status === "defective" || cb.status === "damaged") {
            const cuttingReview = cb.adminDefectReview?.departmentReviews?.[0];
            return cuttingReview?.decision === "approved";
          }
          return true;
        });

        cuttingPayments = eligibleCuttingBarcodes.map((cb) => ({
          barcodeId: cb.id,
          department: "Cutting",
          amount: cb.departmentRates[0]?.ratePerPiece || 0,
          paidBy: session.name || "Admin",
          paidAt: new Date(),
        }));

        if (logIds.length === 0 && cuttingPayments.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `All cut pieces for Cutting Master${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid. Payment was already completed.`,
            },
            { status: 400 }
          );
        }
      } else if (["Packing", "Store"].includes(department || "")) {
        const unpaidStickers = await prisma.finalSticker.findMany({
          where: {
            status: { notIn: ["defective", "damaged"] },
            ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
            departmentHistory: {
              some: { department, scannedBy: { equals: nameToMatch, mode: "insensitive" } },
            },
            paidDepartments: { none: { department } },
          },
          include: {
            departmentRates: { where: { department } },
          },
        });

        if (unpaidStickers.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `All ${department} pieces for "${nameToMatch}"${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid.`,
            },
            { status: 400 }
          );
        }

        stickerPayments = unpaidStickers.map((st) => {
          const rate = st.departmentRates[0]?.ratePerPiece || fallbackRate;
          return {
            finalStickerId: st.id,
            department: department || "Packing",
            amount: rate,
            paidBy: session.name || "Admin",
            paidAt: new Date(),
          };
        });
      } else {
        const unpaidBarcodes = await prisma.barcode.findMany({
          where: {
            ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
            departmentHistory: {
              some: { department, scannedBy: { equals: nameToMatch, mode: "insensitive" } },
            },
            paidDepartments: { none: { department } },
          },
          include: {
            departmentRates: { where: { department } },
            defectiveInfo: true,
            adminDefectReview: {
              include: {
                departmentReviews: true,
              },
            },
          },
        });

        const eligibleBarcodes = unpaidBarcodes.filter((b) => {
          if (department !== "Sewing") return true;
          const isDefectiveOrDamaged = b.status === "defective" || b.status === "damaged";
          if (!isDefectiveOrDamaged) return true;
          if (b.defectiveInfo?.isCompanionDefect) return true;
          const deptReviews = b.adminDefectReview?.departmentReviews || [];
          const currentDeptReview = deptReviews.find((dr) => dr.department === department);
          const decision = currentDeptReview?.decision;
          return decision === "approved";
        });

        if (eligibleBarcodes.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `All ${department} pieces for "${nameToMatch}"${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid or withheld.`,
            },
            { status: 400 }
          );
        }

        barcodePayments = eligibleBarcodes.map((ub) => {
          const itemMatch = ub.departmentRates.find(
            (r) => r.department === department && r.item === ub.item
          );
          const deptMatch = ub.departmentRates.find(
            (r) => r.department === department
          );
          const rate = itemMatch?.ratePerPiece ?? deptMatch?.ratePerPiece ?? fallbackRate;
          return {
            barcodeId: ub.id,
            department: department || "Sewing",
            amount: rate,
            paidBy: session.name || "Admin",
            paidAt: new Date(),
          };
        });
      }

      // Calculate gross amount for eligible pieces
      let grossAmount = 0;
      if (department === "Cutting") {
        grossAmount = cuttingPayments.reduce((sum, cp) => sum + (cp.amount || 0), 0);
      } else if (["Packing", "Store"].includes(department || "")) {
        grossAmount = stickerPayments.reduce((sum, sp) => sum + (sp.amount || 0), 0);
      } else {
        grossAmount = barcodePayments.reduce((sum, bp) => sum + (bp.amount || 0), 0);
      }

      // Fetch pending unsettled adjustments for this worker & department (across ANY design)
      const unsettledAdjustments = await prisma.defectDepartmentReview.findMany({
        where: {
          department: department || "",
          workerName: { equals: nameToMatch, mode: "insensitive" },
          decision: "adjusted",
          isSettled: false,
        },
        include: {
          adminReview: {
            include: {
              barcode: true,
            },
          },
        },
        orderBy: { decidedAt: "asc" },
      });

      // Greedily match adjustments up to grossAmount
      let remainingGross = grossAmount;
      const adjustmentsToSettle: any[] = [];
      let totalAdjustmentsDeducted = 0;

      for (const adj of unsettledAdjustments) {
        if (remainingGross <= 0) break;
        if (adj.rate <= remainingGross) {
          adjustmentsToSettle.push(adj);
          totalAdjustmentsDeducted += adj.rate;
          remainingGross -= adj.rate;
        }
      }

      let laborExpenseAccount = await prisma.account.findFirst({
        where: {
          rootType: "directExpense",
          title: { contains: department || "Labor", mode: "insensitive" },
        },
      });
      if (!laborExpenseAccount) {
        laborExpenseAccount = await prisma.account.findUnique({ where: { code: "DE-103" } });
      }
      if (!laborExpenseAccount) {
        laborExpenseAccount = await prisma.account.findFirst({ where: { rootType: "directExpense" } });
      }
      if (!laborExpenseAccount) {
        laborExpenseAccount = await prisma.account.create({
          data: {
            code: "DE-WAGES",
            title: "Direct Labor / Piece Wages",
            rootType: "directExpense",
            description: "Factory piece-rate wages and labor expense",
            status: "active",
          },
        });
      }

      let defectRecoveryAccount = await prisma.account.findFirst({
        where: {
          rootType: "directExpense",
          code: "DE-RECOV",
        },
      });
      if (!defectRecoveryAccount) {
        defectRecoveryAccount = await prisma.account.findFirst({
          where: {
            title: { contains: "Defect", mode: "insensitive" },
          },
        });
      }
      if (!defectRecoveryAccount) {
        defectRecoveryAccount = await prisma.account.create({
          data: {
            code: "DE-RECOV",
            title: "Defect Wage Adjustments & Recovery",
            rootType: "directExpense",
            accountRole: "general",
            description: "Contra labor expense account for defect wage adjustments recovered from workers",
            status: "active",
          },
        });
      }

      const voucherType: VoucherType = wageAmount === 0 ? "JV" : (paymentMode === "cash" ? "CPV" : "BPV");
      const voucherNumber = await generateSequenceNumber(voucherType);

      const voucher = await prisma.$transaction(
        async (tx) => {
          const designText = targetDesign ? ` [Design: ${targetDesign}]` : "";
          const refText = ref ? ` (Ref: ${ref})` : "";
          const adjustmentNote =
            totalAdjustmentsDeducted > 0
              ? ` [Less Defect Adjustment: -₨${totalAdjustmentsDeducted} (${adjustmentsToSettle.length} defective piece(s))]`
              : "";

          const journalLinesData: any[] = [];

          // 1. Debit Direct Labor Expense for the new pieces completed (Gross amount)
          if (grossAmount > 0) {
            journalLinesData.push({
              accountId: laborExpenseAccount!.id,
              partyId: workerParty.id,
              debit: grossAmount,
              credit: 0,
              description: `${department || "Factory"} piece wages for ${workerParty.name}${designText}${refText}`,
            });
          }

          // 2. Credit Defect Recovery Account for the adjustments deducted
          if (totalAdjustmentsDeducted > 0) {
            journalLinesData.push({
              accountId: defectRecoveryAccount!.id,
              partyId: workerParty.id,
              debit: 0,
              credit: totalAdjustmentsDeducted,
              description: `Defect wage deduction recovered from ${workerParty.name} (${adjustmentsToSettle.length} piece(s) adjusted)`,
            });
          }

          // 3. Credit Cash/Bank Account for net cash disbursed (if any)
          if (wageAmount > 0) {
            journalLinesData.push({
              accountId: paidFromAccount.id,
              partyId: workerParty.id,
              debit: 0,
              credit: wageAmount,
              description: `Wages paid from ${paidFromAccount.title} (${paymentMode || "cash"})${designText}${refText}`,
            });
          }

          const voucherDescription =
            wageAmount === 0
              ? `Defect wage adjustment settlement for ${workerParty.name} (${department || "Production"})${designText}${adjustmentNote}${refText}`
              : `Wages payment to ${workerParty.name} (${department || "Production"})${designText}${adjustmentNote}${refText}`;

          const newVoucher = await tx.voucher.create({
            data: {
              voucherNumber,
              type: voucherType,
              transactionDate: new Date(),
              financialYearId: fy.id,
              partyId: workerParty.id,
              sourceType: "wage",
              description: voucherDescription,
              totalAmount: wageAmount > 0 ? wageAmount : grossAmount,
              paymentMode: wageAmount === 0 ? "cash" : (paymentMode || "cash"),
              referenceNumber: ref,
              status: "posted",
              createdById: validUserId,
              postedById: validUserId,
              postedAt: new Date(),
            },
          });

          if (journalLinesData.length > 0) {
            const totalDebit = journalLinesData.reduce((s, l) => s + (l.debit || 0), 0);
            const totalCredit = journalLinesData.reduce((s, l) => s + (l.credit || 0), 0);

            await tx.journalEntry.create({
              data: {
                voucherId: newVoucher.id,
                financialYearId: fy.id,
                transactionDate: new Date(),
                description: `Wages payout/settlement: Rs. ${wageAmount} (Gross: Rs. ${grossAmount}) to ${workerParty.name}${designText}${adjustmentNote}${refText}`,
                totalDebit,
                totalCredit,
                status: "posted",
                lines: {
                  create: journalLinesData,
                },
              },
            });
          }

          // Settle defect adjustments if any were deducted in this payout
          if (adjustmentsToSettle.length > 0) {
            const adjIds = adjustmentsToSettle.map((a) => a.id);
            await tx.defectDepartmentReview.updateMany({
              where: { id: { in: adjIds } },
              data: {
                isSettled: true,
                settledVoucherId: newVoucher.voucherNumber,
                settledAt: new Date(),
              },
            });
          }

          // Synchronize operational piece status to Paid in bulk
          if (department === "Cutting") {
            if (logIds.length > 0) {
              try {
                await tx.pOReceivingLogItem.updateMany({
                  where: {
                    receivingLogId: { in: logIds },
                    isPaid: false,
                  },
                  data: {
                    isPaid: true,
                    paidAt: new Date(),
                    paidAmount: wageAmount,
                    voucherNumber: newVoucher.voucherNumber,
                    paymentMode: paymentMode || "cash",
                  },
                });

                await tx.pOReceivingLog.updateMany({
                  where: {
                    id: { in: logIds },
                  },
                  data: {
                    voucherNumber: newVoucher.voucherNumber,
                    paymentMode: paymentMode || "cash",
                  },
                });
              } catch (err: any) {
                console.warn("Prisma updateMany schema cache fallback to raw SQL:", err?.message);
                for (const lid of logIds) {
                  await tx.$executeRaw`
                    UPDATE "POReceivingLogItem"
                    SET "isPaid" = true, "paidAt" = NOW(), "paidAmount" = ${wageAmount}, "voucherNumber" = ${newVoucher.voucherNumber}, "paymentMode" = ${paymentMode || "cash"}
                    WHERE "receivingLogId" = ${lid} AND "isPaid" = false
                  `;
                  await tx.$executeRaw`
                    UPDATE "POReceivingLog"
                    SET "voucherNumber" = ${newVoucher.voucherNumber}, "paymentMode" = ${paymentMode || "cash"}
                    WHERE "id" = ${lid}
                  `;
                }
              }
            }

            if (cuttingPayments.length > 0) {
              await tx.barcodePayment.createMany({
                data: cuttingPayments,
                skipDuplicates: true,
              });
            }
          } else if (["Packing", "Store"].includes(department || "")) {
            if (stickerPayments.length > 0) {
              await tx.finalStickerPayment.createMany({
                data: stickerPayments,
                skipDuplicates: true,
              });
            }
          } else {
            if (barcodePayments.length > 0) {
              await tx.barcodePayment.createMany({
                data: barcodePayments,
                skipDuplicates: true,
              });
            }
          }

          return newVoucher;
        },
        {
          maxWait: 15000,
          timeout: 30000,
        }
      );

      try {
        await prisma.auditLog.create({
          data: {
            userId: validUserId,
            userName: session.name,
            action: "PAY_WORKER_WAGES",
            entityType: "Voucher",
            entityId: voucher.id,
            reason: `Paid wages to ${workerParty.name}: Rs. ${wageAmount} (${department})`,
          },
        });
      } catch (auditErr) {
        console.warn("Audit log creation skipped:", auditErr);
      }

      return NextResponse.json({
        success: true,
        message: `Wages of Rs. ${wageAmount.toLocaleString()} recorded and voucher posted for ${workerParty.name}.`,
        voucher: { ...voucher, _id: voucher.id },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Wages API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
