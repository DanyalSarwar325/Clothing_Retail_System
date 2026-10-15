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

    const advanceAccount = await prisma.account.findFirst({
      where: { accountRole: "workerAdvance" },
    });

    const advancesByParty: Record<string, number> = {};
    if (advanceAccount) {
      const advanceLines = await prisma.journalLine.findMany({
        where: {
          accountId: advanceAccount.id,
          journalEntry: { status: "posted" },
        },
      });

      for (const line of advanceLines) {
        if (line.partyId) {
          advancesByParty[line.partyId] =
            (advancesByParty[line.partyId] || 0) + (line.debit - line.credit);
        }
      }
    }

    const enrichedWorkers = workerParties.map((w) => ({
      ...w,
      _id: w.id,
      advanceBalance: Math.max(0, advancesByParty[w.id] || 0),
    }));

    let departmentData = null;
    if (department) {
      try {
        const origin = request.nextUrl.origin;
        const res = await fetch(
          `${origin}/api/payment/department?department=${encodeURIComponent(department)}`
        );
        const data = await res.json();
        if (data.success) {
          departmentData = data;
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
      advanceDeduction,
      paidFromAccountId,
      paymentMode,
      notes,
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
      const advanceAmount = Number(amount);
      if (!advanceAmount || advanceAmount <= 0) {
        return NextResponse.json(
          { success: false, error: "Valid advance amount required" },
          { status: 400 }
        );
      }

      let advanceAccount = await prisma.account.findFirst({
        where: { accountRole: "workerAdvance", status: "active" },
      });
      if (!advanceAccount) {
        advanceAccount = await prisma.account.findUnique({ where: { code: "AS-302" } });
      }
      if (!advanceAccount) {
        throw new Error("Worker Advance asset account not found in Chart of Accounts.");
      }

      const voucherType: VoucherType = paymentMode === "cash" ? "CPV" : "BPV";
      const voucherNumber = await generateSequenceNumber(voucherType);

      const voucher = await prisma.$transaction(async (tx) => {
        const newVoucher = await tx.voucher.create({
          data: {
            voucherNumber,
            type: voucherType,
            transactionDate: new Date(),
            financialYearId: fy.id,
            partyId: workerParty.id,
            sourceType: "advance",
            description: `Advance (Peshgi) given to ${workerParty.name}${notes ? ` - ${notes}` : ""}`,
            totalAmount: advanceAmount,
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
            description: `Advance of Rs. ${advanceAmount} given to ${workerParty.name}`,
            totalDebit: advanceAmount,
            totalCredit: advanceAmount,
            status: "posted",
            lines: {
              create: [
                {
                  accountId: advanceAccount.id,
                  partyId: workerParty.id,
                  debit: advanceAmount,
                  credit: 0,
                  description: `Advance loan given to ${workerParty.name}`,
                },
                {
                  accountId: paidFromAccount.id,
                  partyId: workerParty.id,
                  debit: 0,
                  credit: advanceAmount,
                  description: `Disbursed from ${paidFromAccount.title}`,
                },
              ],
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: session.id,
            userName: session.name,
            action: "GIVE_WORKER_ADVANCE",
            entityType: "Voucher",
            entityId: newVoucher.id,
            reason: `Disbursed Rs. ${advanceAmount} advance to ${workerParty.name}`,
          },
        });

        return newVoucher;
      });

      return NextResponse.json({
        success: true,
        message: `Advance of Rs. ${advanceAmount} recorded for ${workerParty.name}.`,
        voucher: { ...voucher, _id: voucher.id },
      });
    }

    if (action === "pay_wages") {
      const grossWage = Number(amount);
      const deduction = Number(advanceDeduction || 0);
      const netPayCash = grossWage - deduction;

      if (grossWage <= 0 || netPayCash < 0) {
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

      const advanceAccount = await prisma.account.findFirst({
        where: { accountRole: "workerAdvance" },
      });

      const voucherType: VoucherType = paymentMode === "cash" ? "CPV" : "BPV";
      const voucherNumber = await generateSequenceNumber(voucherType);

      const voucher = await prisma.$transaction(async (tx) => {
        const journalLinesData = [
          {
            accountId: laborExpenseAccount!.id,
            partyId: workerParty.id,
            debit: grossWage,
            credit: 0,
            description: `${department || "Factory"} piece wages for ${workerParty.name}`,
          },
        ];

        if (deduction > 0 && advanceAccount) {
          journalLinesData.push({
            accountId: advanceAccount.id,
            partyId: workerParty.id,
            debit: 0,
            credit: deduction,
            description: "Advance adjusted against wages",
          });
        }

        if (netPayCash > 0) {
          journalLinesData.push({
            accountId: paidFromAccount.id,
            partyId: workerParty.id,
            debit: 0,
            credit: netPayCash,
            description: `Net wages paid from ${paidFromAccount.title} (${paymentMode})`,
          });
        }

        const newVoucher = await tx.voucher.create({
          data: {
            voucherNumber,
            type: voucherType,
            transactionDate: new Date(),
            financialYearId: fy.id,
            partyId: workerParty.id,
            sourceType: "wage",
            description: `Wages payment to ${workerParty.name} (${department || "Production"})${deduction > 0 ? ` [Adv deducted: Rs. ${deduction}]` : ""}`,
            totalAmount: netPayCash,
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
            description: `Wages payout: Gross Rs. ${grossWage}, Net Rs. ${netPayCash} to ${workerParty.name}`,
            totalDebit: grossWage,
            totalCredit: grossWage,
            status: "posted",
            lines: {
              create: journalLinesData,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: session.id,
            userName: session.name,
            action: "PAY_WORKER_WAGES",
            entityType: "Voucher",
            entityId: newVoucher.id,
            reason: `Paid wages to ${workerParty.name}: Gross Rs. ${grossWage}, Net Rs. ${netPayCash}`,
          },
        });

        return newVoucher;
      });

      return NextResponse.json({
        success: true,
        message: `Wages of Rs. ${netPayCash} recorded for ${workerParty.name} (Gross: Rs. ${grossWage}).`,
        voucher: { ...voucher, _id: voucher.id },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Wages API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
