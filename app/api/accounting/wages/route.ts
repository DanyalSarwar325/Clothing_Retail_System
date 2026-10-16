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

      if (wageAmount <= 0) {
        return NextResponse.json({ success: false, error: "Invalid wage calculation" }, { status: 400 });
      }

      // Pre-check: Ensure there are unpaid pieces for this worker to prevent double payouts
      const nameToMatch = department === "Cutting" ? "Cutting Master" : (workerName?.trim() || workerParty.name);
      if (department === "Cutting") {
        const unpaidCuttingLogs = await prisma.pOReceivingLog.findMany({
          where: {
            ...(targetDesign ? { po: { design: { equals: targetDesign, mode: "insensitive" } } } : {}),
            items: { some: { isPaid: false } },
          },
          include: {
            items: { where: { isPaid: false } },
          },
        });
        const hasUnpaid = unpaidCuttingLogs.some((l) => l.items.length > 0);
        if (!hasUnpaid) {
          return NextResponse.json(
            {
              success: false,
              error: `All cut pieces for Cutting Master${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid. Payment was already completed.`,
            },
            { status: 400 }
          );
        }
      } else if (["Packing", "Store"].includes(department || "")) {
        const unpaidStickers = await prisma.finalSticker.findFirst({
          where: {
            ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
            departmentHistory: {
              some: { department, scannedBy: { equals: workerParty.name, mode: "insensitive" } },
            },
            paidDepartments: { none: { department } },
          },
        });
        if (!unpaidStickers) {
          return NextResponse.json(
            {
              success: false,
              error: `All ${department} pieces for "${workerParty.name}"${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid.`,
            },
            { status: 400 }
          );
        }
      } else {
        const unpaidBarcode = await prisma.barcode.findFirst({
          where: {
            ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
            departmentHistory: {
              some: { department, scannedBy: { equals: workerParty.name, mode: "insensitive" } },
            },
            paidDepartments: { none: { department } },
          },
        });
        if (!unpaidBarcode) {
          return NextResponse.json(
            {
              success: false,
              error: `All ${department} pieces for "${workerParty.name}"${targetDesign ? ` [Design: ${targetDesign}]` : ""} have already been paid.`,
            },
            { status: 400 }
          );
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

      const voucherType: VoucherType = paymentMode === "cash" ? "CPV" : "BPV";
      const voucherNumber = await generateSequenceNumber(voucherType);

      const voucher = await prisma.$transaction(async (tx) => {
        const designText = targetDesign ? ` [Design: ${targetDesign}]` : "";
        const refText = ref ? ` (Ref: ${ref})` : "";
        const journalLinesData = [
          {
            accountId: laborExpenseAccount!.id,
            partyId: workerParty.id,
            debit: wageAmount,
            credit: 0,
            description: `${department || "Factory"} piece wages for ${workerParty.name}${designText}${refText}`,
          },
          {
            accountId: paidFromAccount.id,
            partyId: workerParty.id,
            debit: 0,
            credit: wageAmount,
            description: `Wages paid from ${paidFromAccount.title} (${paymentMode || "cash"})${designText}${refText}`,
          },
        ];

        const newVoucher = await tx.voucher.create({
          data: {
            voucherNumber,
            type: voucherType,
            transactionDate: new Date(),
            financialYearId: fy.id,
            partyId: workerParty.id,
            sourceType: "wage",
            description: `Wages payment to ${workerParty.name} (${department || "Production"})${designText}${refText}`,
            totalAmount: wageAmount,
            paymentMode: paymentMode || "cash",
            referenceNumber: ref,
            status: "posted",
            createdById: validUserId,
            postedById: validUserId,
            postedAt: new Date(),
          },
        });

        await tx.journalEntry.create({
          data: {
            voucherId: newVoucher.id,
            financialYearId: fy.id,
            transactionDate: new Date(),
            description: `Wages payout: Rs. ${wageAmount} to ${workerParty.name}${designText}${refText}`,
            totalDebit: wageAmount,
            totalCredit: wageAmount,
            status: "posted",
            lines: {
              create: journalLinesData,
            },
          },
        });

        // Synchronize operational piece status to Paid
        if (department === "Cutting") {
          const matchingLogs = await tx.pOReceivingLog.findMany({
            where: targetDesign
              ? { po: { design: { equals: targetDesign, mode: "insensitive" } } }
              : {},
            select: { id: true },
          });
          const logIds = matchingLogs.map((l) => l.id);

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
                  voucherNumber: voucher.voucherNumber,
                  paymentMode: paymentMode || "cash",
                },
              });

              await tx.pOReceivingLog.updateMany({
                where: {
                  id: { in: logIds },
                },
                data: {
                  voucherNumber: voucher.voucherNumber,
                  paymentMode: paymentMode || "cash",
                },
              });
            } catch (err: any) {
              console.warn("Prisma updateMany schema cache fallback to raw SQL:", err?.message);
              for (const lid of logIds) {
                await tx.$executeRaw`
                  UPDATE "POReceivingLogItem"
                  SET "isPaid" = true, "paidAt" = NOW(), "paidAmount" = ${wageAmount}, "voucherNumber" = ${voucher.voucherNumber}, "paymentMode" = ${paymentMode || "cash"}
                  WHERE "receivingLogId" = ${lid} AND "isPaid" = false
                `;
                await tx.$executeRaw`
                  UPDATE "POReceivingLog"
                  SET "voucherNumber" = ${voucher.voucherNumber}, "paymentMode" = ${paymentMode || "cash"}
                  WHERE "id" = ${lid}
                `;
              }
            }
          }

          // 2. Also mark any existing generated barcodes for this cutting person
          const cuttingBarcodes = await tx.barcode.findMany({
            where: {
              ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
              departmentHistory: {
                some: {
                  department: "Cutting",
                  scannedBy: {
                    equals: workerParty.name,
                    mode: "insensitive",
                  },
                },
              },
              paidDepartments: {
                none: { department: "Cutting" },
              },
            },
            include: {
              departmentRates: { where: { department: "Cutting" } },
            },
          });

          for (const cb of cuttingBarcodes) {
            const rate = cb.departmentRates[0]?.ratePerPiece || 0;
            try {
              await tx.barcodePayment.create({
                data: {
                  barcodeId: cb.id,
                  department: "Cutting",
                  amount: rate,
                  paidBy: session.name || "Admin",
                  paidAt: new Date(),
                },
              });
            } catch {
              // already paid
            }
          }
        } else if (["Packing", "Store"].includes(department || "")) {
          const unpaidStickers = await tx.finalSticker.findMany({
            where: {
              ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
              departmentHistory: {
                some: {
                  department,
                  scannedBy: { equals: workerParty.name, mode: "insensitive" },
                },
              },
              paidDepartments: {
                none: { department },
              },
            },
            include: {
              departmentRates: { where: { department } },
            },
          });

          for (const st of unpaidStickers) {
            const rate = st.departmentRates[0]?.ratePerPiece || 0;
            try {
              await tx.finalStickerPayment.create({
                data: {
                  finalStickerId: st.id,
                  department,
                  amount: rate,
                  paidBy: session.name || "Admin",
                  paidAt: new Date(),
                },
              });
            } catch { }
          }
        } else {
          // Item-scanned departments (Sewing, Quality, Overlock, Clipping, Handmade, Adda Work, Patching, Press)
          const unpaidBarcodes = await tx.barcode.findMany({
            where: {
              ...(targetDesign ? { design: { equals: targetDesign, mode: "insensitive" } } : {}),
              departmentHistory: {
                some: {
                  department,
                  scannedBy: { equals: workerParty.name, mode: "insensitive" },
                },
              },
              paidDepartments: {
                none: { department },
              },
            },
            include: {
              departmentRates: { where: { department } },
            },
          });

          for (const ub of unpaidBarcodes) {
            const itemMatch = ub.departmentRates.find((r) => r.item === ub.item);
            const rate = itemMatch?.ratePerPiece ?? ub.departmentRates[0]?.ratePerPiece ?? 0;
            try {
              await tx.barcodePayment.create({
                data: {
                  barcodeId: ub.id,
                  department,
                  amount: rate,
                  paidBy: session.name || "Admin",
                  paidAt: new Date(),
                },
              });
            } catch { }
          }
        }

        try {
          await tx.auditLog.create({
            data: {
              userId: validUserId,
              userName: session.name,
              action: "PAY_WORKER_WAGES",
              entityType: "Voucher",
              entityId: newVoucher.id,
              reason: `Paid wages to ${workerParty.name}: Rs. ${wageAmount} (${department})`,
            },
          });
        } catch (auditErr) {
          console.warn("Audit log creation skipped:", auditErr);
        }

        return newVoucher;
      });

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
