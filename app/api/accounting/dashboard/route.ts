import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { ensureAccountingSeeded } from "@/app/libs/accounting/seedAccounting";

export async function GET(request: Request) {
  try {
    await ensureAccountingSeeded();

    const { searchParams } = new URL(request.url);
    const fyId = searchParams.get("financialYearId");

    let financialYear;
    if (fyId) {
      financialYear = await prisma.financialYear.findUnique({ where: { id: fyId } });
    } else {
      financialYear =
        (await prisma.financialYear.findFirst({ where: { isCurrent: true } })) ||
        (await prisma.financialYear.findFirst({ orderBy: { startDate: "desc" } }));
    }

    const rawAllYears = await prisma.financialYear.findMany({
      orderBy: { startDate: "desc" },
    });
    const allYears = rawAllYears.map((y) => ({ ...y, _id: y.id }));

    const accounts = await prisma.account.findMany({ where: { status: "active" } });
    const cashAccountIds = new Set(accounts.filter((a) => a.accountRole === "cash").map((a) => a.id));
    const bankAccountIds = new Set(accounts.filter((a) => a.accountRole === "bank").map((a) => a.id));
    const receivableAccountIds = new Set(accounts.filter((a) => a.accountRole === "accountsReceivable").map((a) => a.id));
    const inventoryAccountIds = new Set(
      accounts
        .filter((a) => ["rawMaterialInventory", "wipInventory", "finishedGoodsInventory"].includes(a.accountRole || ""))
        .map((a) => a.id)
    );
    const directExpenseIds = new Set(accounts.filter((a) => a.rootType === "directExpense").map((a) => a.id));
    const indirectExpenseIds = new Set(accounts.filter((a) => a.rootType === "indirectExpense").map((a) => a.id));
    const revenueIds = new Set(accounts.filter((a) => a.rootType === "revenue").map((a) => a.id));

    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        status: "posted",
        ...(financialYear ? { financialYearId: financialYear.id } : {}),
      },
      include: {
        lines: true,
      },
    });

    let cashBalance = 0;
    let bankBalance = 0;
    let customerReceivableBalance = 0;
    let stockValue = 0;
    let totalDirectExpense = 0;
    let totalIndirectExpense = 0;
    let totalRevenue = 0;

    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        const accId = line.accountId;

        if (cashAccountIds.has(accId)) {
          cashBalance += line.debit - line.credit;
        } else if (bankAccountIds.has(accId)) {
          bankBalance += line.debit - line.credit;
        } else if (receivableAccountIds.has(accId)) {
          customerReceivableBalance += line.debit - line.credit;
        } else if (inventoryAccountIds.has(accId)) {
          stockValue += line.debit - line.credit;
        } else if (directExpenseIds.has(accId)) {
          totalDirectExpense += line.debit - line.credit;
        } else if (indirectExpenseIds.has(accId)) {
          totalIndirectExpense += line.debit - line.credit;
        } else if (revenueIds.has(accId)) {
          totalRevenue += line.credit - line.debit;
        }
      }
    }

    const unpaidBills = await prisma.bill.findMany({
      where: {
        status: "posted",
        paymentStatus: { in: ["unpaid", "partially_paid"] },
        ...(financialYear ? { financialYearId: financialYear.id } : {}),
      },
    });

    const totalToPay = unpaidBills.reduce((sum, bill) => {
      const remaining = Math.max(0, bill.totalAmount - (bill.paidAmount || 0));
      return sum + remaining;
    }, 0);

    const grossProfit = totalRevenue - totalDirectExpense;
    const netProfitOrLoss = grossProfit - totalIndirectExpense;

    const rawRecentVouchers = await prisma.voucher.findMany({
      where: financialYear ? { financialYearId: financialYear.id } : {},
      include: {
        party: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 8,
    });

    const recentVouchers = rawRecentVouchers.map((v) => ({
      ...v,
      _id: v.id,
      partyId: v.party ? { ...v.party, _id: v.party.id } : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        financialYear: financialYear ? { ...financialYear, _id: financialYear.id } : null,
        allYears,
        summary: {
          cashInHand: cashBalance,
          bankBalance: bankBalance,
          totalToPay: totalToPay,
          totalToReceive: Math.max(0, customerReceivableBalance),
          totalManufacturingCost: totalDirectExpense,
          totalExpenses: totalIndirectExpense,
          totalRevenue: totalRevenue,
          grossProfit: grossProfit,
          netProfitOrLoss: netProfitOrLoss,
          stockValue: Math.max(0, stockValue),
        },
        recentVouchers,
      },
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
