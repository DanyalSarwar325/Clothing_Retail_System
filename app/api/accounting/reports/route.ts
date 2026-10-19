import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "profit-loss";
    const fyId = searchParams.get("financialYearId");

    let fy;
    if (fyId) {
      fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
    } else {
      fy =
        (await prisma.financialYear.findFirst({ where: { isCurrent: true } })) ||
        (await prisma.financialYear.findFirst({ orderBy: { startDate: "desc" } }));
    }

    const journalQuery: any = { status: "posted" };
    if (fy) {
      journalQuery.financialYearId = fy.id;
    }

    const journalEntries = await prisma.journalEntry.findMany({
      where: journalQuery,
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, title: true, rootType: true, accountRole: true } },
            party: { select: { id: true, name: true, type: true } },
          },
        },
        voucher: { select: { voucherNumber: true } },
      },
      orderBy: { transactionDate: "asc" },
    });

    const rawAccounts = await prisma.account.findMany({
      where: { status: "active" },
      orderBy: { code: "asc" },
    });

    const accounts = rawAccounts.map((a: any) => ({ ...a, _id: a.id }));

    // 1. REPORT: PROFIT & LOSS STATEMENT
    if (reportType === "profit-loss") {
      let revenueTotal = 0;
      let cogsTotal = 0;
      let operatingExpenseTotal = 0;

      const revenueLines: Array<{ title: string; code: string; amount: number }> = [];
      const cogsLines: Array<{ title: string; code: string; amount: number }> = [];
      const expenseLines: Array<{ title: string; code: string; amount: number }> = [];

      const accountBalances: Record<string, number> = {};
      for (const entry of journalEntries) {
        for (const line of entry.lines) {
          const accId = line.accountId;
          const net = line.debit - line.credit;
          accountBalances[accId] = (accountBalances[accId] || 0) + net;
        }
      }

      for (const acc of accounts) {
        const bal = accountBalances[acc.id] || 0;
        if (bal === 0) continue;

        if (acc.rootType === "revenue") {
          const revAmount = -bal;
          revenueTotal += revAmount;
          revenueLines.push({ title: acc.title, code: acc.code, amount: revAmount });
        } else if (acc.rootType === "directExpense") {
          cogsTotal += bal;
          cogsLines.push({ title: acc.title, code: acc.code, amount: bal });
        } else if (acc.rootType === "indirectExpense") {
          operatingExpenseTotal += bal;
          expenseLines.push({ title: acc.title, code: acc.code, amount: bal });
        }
      }

      const grossProfit = revenueTotal - cogsTotal;
      const netProfitOrLoss = grossProfit - operatingExpenseTotal;

      return NextResponse.json({
        success: true,
        data: {
          financialYear: fy ? { ...fy, _id: fy.id } : null,
          revenueLines,
          revenueTotal,
          cogsLines,
          cogsTotal,
          grossProfit,
          expenseLines,
          operatingExpenseTotal,
          netProfitOrLoss,
        },
      });
    }

    // 2. REPORT: TRIAL BALANCE
    if (reportType === "trial-balance") {
      const accountDebitCredit: Record<string, { debit: number; credit: number }> = {};

      for (const entry of journalEntries) {
        for (const line of entry.lines) {
          const accId = line.accountId;
          if (!accountDebitCredit[accId]) {
            accountDebitCredit[accId] = { debit: 0, credit: 0 };
          }
          accountDebitCredit[accId].debit += line.debit;
          accountDebitCredit[accId].credit += line.credit;
        }
      }

      let grandTotalDebit = 0;
      let grandTotalCredit = 0;

      const lines = accounts
        .map((acc) => {
          const totals = accountDebitCredit[acc.id] || { debit: 0, credit: 0 };
          const net = totals.debit - totals.credit;

          let netDebit = 0;
          let netCredit = 0;

          if (net > 0) {
            netDebit = net;
          } else if (net < 0) {
            netCredit = -net;
          }

          grandTotalDebit += netDebit;
          grandTotalCredit += netCredit;

          return {
            accountId: acc.id,
            code: acc.code,
            title: acc.title,
            rootType: acc.rootType,
            debit: netDebit,
            credit: netCredit,
          };
        })
        .filter((l) => l.debit > 0 || l.credit > 0);

      const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 1;

      return NextResponse.json({
        success: true,
        data: {
          financialYear: fy ? { ...fy, _id: fy.id } : null,
          lines,
          grandTotalDebit,
          grandTotalCredit,
          isBalanced,
        },
      });
    }

    // 3. REPORT: CASH BOOK / BANK BOOK
    if (reportType === "cash-book") {
      const cashBankAccs = accounts.filter((a) => ["cash", "bank"].includes(a.accountRole || ""));
      const cashBankIds = new Set(cashBankAccs.map((a) => a.id));

      interface CashBookLine {
        date: Date;
        voucherNumber: string;
        accountTitle: string;
        partyName?: string;
        description: string;
        inflow: number;
        outflow: number;
        balance: number;
      }

      const bookRows: CashBookLine[] = [];
      let running = 0;

      for (const entry of journalEntries) {
        for (const line of entry.lines) {
          if (cashBankIds.has(line.accountId)) {
            running += line.debit - line.credit;
            bookRows.push({
              date: entry.transactionDate,
              voucherNumber: entry.voucher?.voucherNumber || "VCHR",
              accountTitle: line.account?.title || "Cash/Bank",
              partyName: line.party?.name,
              description: line.description || entry.description,
              inflow: line.debit,
              outflow: line.credit,
              balance: running,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          financialYear: fy ? { ...fy, _id: fy.id } : null,
          rows: bookRows,
          closingBalance: running,
        },
      });
    }

    // 4. REPORT: OUTSTANDING BALANCES
    if (reportType === "outstanding") {
      const parties = await prisma.party.findMany({
        where: { status: "active" },
        orderBy: { name: "asc" },
      });

      const enriched = await Promise.all(
        parties.map(async (party) => {
          const bills = await prisma.bill.findMany({
            where: { partyId: party.id, status: "posted" },
          });
          const vouchers = await prisma.voucher.findMany({
            where: {
              partyId: party.id,
              status: "posted",
              sourceType: { not: "bill" },
            },
          });

          const totalBills = bills.reduce((sum, b) => sum + b.totalAmount, 0);
          const totalPaid = vouchers.reduce((sum, v) => sum + v.totalAmount, 0);

          let initialBalance = 0;
          if (party.openingBalanceType === "payable") initialBalance = party.openingBalance;
          if (party.openingBalanceType === "receivable") initialBalance = -party.openingBalance;

          const net = initialBalance + totalBills - totalPaid;
          return {
            _id: party.id,
            id: party.id,
            name: party.name,
            type: party.type,
            phone: party.phone,
            netPayable: net,
          };
        })
      );

      const payables = enriched.filter((p) => p.netPayable > 0);
      const receivables = enriched.filter((p) => p.netPayable < 0);

      const totalToPay = payables.reduce((sum, p) => sum + p.netPayable, 0);
      const totalToReceive = receivables.reduce((sum, p) => sum + Math.abs(p.netPayable), 0);

      return NextResponse.json({
        success: true,
        data: {
          financialYear: fy ? { ...fy, _id: fy.id } : null,
          payables,
          receivables,
          totalToPay,
          totalToReceive,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid report type" }, { status: 400 });
  } catch (error: any) {
    console.error("Reports API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
