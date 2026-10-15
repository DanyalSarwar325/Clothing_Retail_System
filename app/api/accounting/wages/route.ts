import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { getActiveFinancialYear, VoucherType } from "@/app/libs/accounting/postingService";
import { generateSequenceNumber } from "@/app/libs/accounting/voucherNumberService";
import { getSession } from "@/app/libs/auth";

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

    const fy = await getActiveFinancialYear();
    const body = await request.json();
    const {
      action,
      workerName,
      workerId,
      department,
      amount,
      paidFromAccountId,
      paymentMode,
    } = body;

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
            createdById: session.id,
          },
        });
      }
    }

    if (!workerParty) {
      return NextResponse.json({ success: false, error: "Worker not specified" }, { status: 400 });
    }

    const paidFromAccount = await prisma.account.findUnique({
      where: { id: paidFromAccountId },
    });
    if (!paidFromAccount) {
      return NextResponse.json(
        { success: false, error: "Paid From cash/bank account not found" },
        { status: 400 }
      );
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

      const voucherType: VoucherType = paymentMode === "cash" ? "CPV" : "BPV";
      const voucherNumber = await generateSequenceNumber(voucherType);

      const voucher = await prisma.$transaction(async (tx) => {
        const journalLinesData = [
          {
            accountId: laborExpenseAccount!.id,
            partyId: workerParty.id,
            debit: wageAmount,
            credit: 0,
            description: `${department || "Factory"} piece wages for ${workerParty.name}`,
          },
          {
            accountId: paidFromAccount.id,
            partyId: workerParty.id,
            debit: 0,
            credit: wageAmount,
            description: `Wages paid from ${paidFromAccount.title} (${paymentMode || "cash"})`,
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
            description: `Wages payment to ${workerParty.name} (${department || "Production"})`,
            totalAmount: wageAmount,
            paymentMode: paymentMode || "cash",
            status: "posted",
            createdById: session.id,
            postedById: session.id,
            postedAt: new Date(),
          },
        });

        await tx.journalEntry.create({
          data: {
            voucherId: newVoucher.id,
            financialYearId: fy.id,
            transactionDate: new Date(),
            description: `Wages payout: Rs. ${wageAmount} to ${workerParty.name}`,
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
          // 1. Mark PO receiving log items as paid for this cutting person
          await tx.pOReceivingLogItem.updateMany({
            where: {
              isPaid: false,
              receivingLog: {
                cuttingPersonName: {
                  equals: workerParty.name,
                  mode: "insensitive",
                },
              },
            },
            data: {
              isPaid: true,
              paidAt: new Date(),
              paidAmount: wageAmount,
            },
          });

          // 2. Also mark any existing generated barcodes for this cutting person
          const cuttingBarcodes = await tx.barcode.findMany({
            where: {
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
            } catch {}
          }
        } else {
          // Item-scanned departments (Sewing, Quality, Overlock, Clipping, Handmade, Adda Work, Patching, Press)
          const unpaidBarcodes = await tx.barcode.findMany({
            where: {
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
            } catch {}
          }
        }

        await tx.auditLog.create({
          data: {
            userId: session.id,
            userName: session.name,
            action: "PAY_WORKER_WAGES",
            entityType: "Voucher",
            entityId: newVoucher.id,
            reason: `Paid wages to ${workerParty.name}: Rs. ${wageAmount} (${department})`,
          },
        });

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
