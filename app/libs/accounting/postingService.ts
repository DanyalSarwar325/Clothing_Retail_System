import prisma from "@/app/libs/prisma";
import { generateSequenceNumber } from "./voucherNumberService";

export type PaymentMode = "cash" | "bank" | "cheque" | "online";
export type VoucherType = "CPV" | "BPV" | "CRV" | "BRV" | "JV";

export interface CreateBillParams {
  partyId: string;
  billDate: Date;
  dueDate?: Date;
  supplierInvoiceNumber?: string;
  billType?: "purchase" | "service" | "other";
  lines: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    accountId?: string;
    amount: number;
  }>;
  subtotal: number;
  taxAmount?: number;
  otherCharges?: number;
  totalAmount: number;
  isPaidImmediately?: boolean;
  paidFromAccountId?: string;
  paymentMode?: PaymentMode;
  notes?: string;
  userId: string;
  userName?: string;
}

export interface CreatePaymentParams {
  partyId: string;
  paymentDate: Date;
  amount: number;
  paidFromAccountId: string;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  description: string;
  billAllocations?: Array<{
    billId: string;
    amount: number;
  }>;
  userId: string;
  userName?: string;
}

export async function getActiveFinancialYear() {
  let fy = await prisma.financialYear.findFirst({
    where: { isCurrent: true, status: "open" },
  });
  if (!fy) {
    fy = await prisma.financialYear.findFirst({
      where: { status: "open" },
      orderBy: { startDate: "desc" },
    });
  }
  if (!fy) {
    throw new Error("No open financial year found. Please configure a financial year first.");
  }
  return fy;
}

export async function postBill(params: CreateBillParams) {
  const fy = await getActiveFinancialYear();

  const party = await prisma.party.findUnique({ where: { id: params.partyId } });
  if (!party) throw new Error("Party not found.");

  let payableAccount = await prisma.account.findFirst({
    where: { accountRole: "accountsPayable", status: "active" },
  });
  if (!payableAccount) {
    payableAccount = await prisma.account.findFirst({
      where: { rootType: "liability", status: "active" },
    });
  }
  if (!payableAccount) throw new Error("Payables liability account not found in Chart of Accounts.");

  let defaultDebitAccount = await prisma.account.findFirst({
    where: { accountRole: "rawMaterialInventory", status: "active" },
  });
  if (!defaultDebitAccount) {
    defaultDebitAccount = await prisma.account.findFirst({
      where: { rootType: "directExpense", status: "active" },
    });
  }
  if (!defaultDebitAccount) throw new Error("Default debit account not found.");

  const billNumber = await generateSequenceNumber("BILL", params.billDate);
  const voucherNumber = await generateSequenceNumber("JV", params.billDate);

  const subtotal = Number(params.subtotal) || 0;
  const taxAmount = Number(params.taxAmount) || 0;
  const otherCharges = Number(params.otherCharges) || 0;
  const totalAmount = Number(params.totalAmount) || 0;

  const billLinesData = params.lines.map((l) => {
    const qty = Number(l.quantity) || 1;
    const rate = Number(l.rate) || 0;
    const lineAmount = Number(l.amount) !== undefined && !isNaN(Number(l.amount)) ? Number(l.amount) : qty * rate;
    return {
      description: l.description,
      quantity: qty,
      unit: l.unit || "",
      rate: rate,
      accountId: l.accountId || defaultDebitAccount!.id,
      amount: lineAmount,
    };
  });

  const createdBill = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type: "JV",
        transactionDate: params.billDate,
        financialYearId: fy.id,
        partyId: party.id,
        sourceType: "bill",
        description: `Purchase Bill ${billNumber} - ${party.name}`,
        totalAmount: totalAmount,
        status: "posted",
        createdById: params.userId,
        postedById: params.userId,
        postedAt: new Date(),
      },
    });

    const bill = await tx.bill.create({
      data: {
        billNumber,
        supplierInvoiceNumber: params.supplierInvoiceNumber,
        partyId: party.id,
        billDate: params.billDate,
        dueDate: params.dueDate,
        financialYearId: fy.id,
        billType: params.billType || "purchase",
        subtotal: subtotal,
        taxAmount: taxAmount,
        otherCharges: otherCharges,
        totalAmount: totalAmount,
        paidAmount: params.isPaidImmediately ? totalAmount : 0,
        paymentStatus: params.isPaidImmediately ? "paid" : "unpaid",
        status: "posted",
        voucherId: voucher.id,
        notes: params.notes,
        createdById: params.userId,
        lines: {
          create: billLinesData,
        },
      },
      include: { lines: true },
    });

    await tx.voucher.update({
      where: { id: voucher.id },
      data: { sourceId: bill.id },
    });

    const journalLines = [
      ...billLinesData.map((l) => ({
        accountId: l.accountId,
        partyId: party.id,
        debit: l.amount,
        credit: 0,
        description: l.description,
      })),
      {
        accountId: payableAccount!.id,
        partyId: party.id,
        debit: 0,
        credit: totalAmount,
        description: `Bill ${billNumber} payable to ${party.name}`,
      },
    ];

    await tx.journalEntry.create({
      data: {
        voucherId: voucher.id,
        financialYearId: fy.id,
        transactionDate: params.billDate,
        description: `Purchase Bill ${billNumber} from ${party.name}`,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
        status: "posted",
        lines: {
          create: journalLines,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: "CREATE_BILL",
        entityType: "Bill",
        entityId: bill.id,
        reason: `Recorded bill ${billNumber} for Rs. ${params.totalAmount}`,
      },
    });

    return bill;
  });

  if (params.isPaidImmediately && params.paidFromAccountId) {
    await postPayment({
      partyId: party.id,
      paymentDate: params.billDate,
      amount: params.totalAmount,
      paidFromAccountId: params.paidFromAccountId,
      paymentMode: params.paymentMode || "cash",
      referenceNumber: `Immediate payment for ${billNumber}`,
      description: `Immediate payment against bill ${billNumber}`,
      billAllocations: [{ billId: createdBill.id, amount: params.totalAmount }],
      userId: params.userId,
      userName: params.userName,
    });
  }

  return createdBill;
}

export async function postPayment(params: CreatePaymentParams) {
  const fy = await getActiveFinancialYear();

  const party = await prisma.party.findUnique({ where: { id: params.partyId } });
  if (!party) throw new Error("Party not found.");

  const paidFromAccount = await prisma.account.findUnique({
    where: { id: params.paidFromAccountId },
  });
  if (!paidFromAccount) throw new Error("Paid From cash/bank account not found.");

  let payableAccount = await prisma.account.findFirst({
    where: { accountRole: "accountsPayable", status: "active" },
  });
  if (!payableAccount) {
    payableAccount = await prisma.account.findFirst({
      where: { rootType: "liability", status: "active" },
    });
  }
  if (!payableAccount) throw new Error("Payables liability account not found.");

  const paymentAmount = Number(params.amount) || 0;
  const voucherType: VoucherType = params.paymentMode === "cash" ? "CPV" : "BPV";
  const voucherNumber = await generateSequenceNumber(voucherType, params.paymentDate);

  const voucher = await prisma.$transaction(async (tx) => {
    const newVoucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type: voucherType,
        transactionDate: params.paymentDate,
        financialYearId: fy.id,
        partyId: party.id,
        sourceType: "payment",
        description: params.description || `Payment made to ${party.name}`,
        totalAmount: paymentAmount,
        paymentMode: params.paymentMode,
        referenceNumber: params.referenceNumber,
        status: "posted",
        createdById: params.userId,
        postedById: params.userId,
        postedAt: new Date(),
      },
    });

    await tx.journalEntry.create({
      data: {
        voucherId: newVoucher.id,
        financialYearId: fy.id,
        transactionDate: params.paymentDate,
        description: params.description || `Payment of Rs. ${paymentAmount} to ${party.name}`,
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        status: "posted",
        lines: {
          create: [
            {
              accountId: payableAccount!.id,
              partyId: party.id,
              debit: paymentAmount,
              credit: 0,
              description: `Payment to ${party.name}`,
            },
            {
              accountId: paidFromAccount.id,
              partyId: party.id,
              debit: 0,
              credit: params.amount,
              description: `Paid via ${paidFromAccount.title} (${params.paymentMode})`,
            },
          ],
        },
      },
    });

    if (params.billAllocations && params.billAllocations.length > 0) {
      for (const alloc of params.billAllocations) {
        if (alloc.amount <= 0) continue;

        const targetBill = await tx.bill.findUnique({ where: { id: alloc.billId } });
        if (targetBill) {
          const remaining = Math.max(0, targetBill.totalAmount - (targetBill.paidAmount || 0));
          const appliedAmount = Math.min(alloc.amount, remaining);

          const newPaidAmount = (targetBill.paidAmount || 0) + appliedAmount;
          let paymentStatus = targetBill.paymentStatus;
          if (newPaidAmount >= targetBill.totalAmount) {
            paymentStatus = "paid";
          } else if (newPaidAmount > 0) {
            paymentStatus = "partially_paid";
          }

          await tx.bill.update({
            where: { id: targetBill.id },
            data: {
              paidAmount: newPaidAmount,
              paymentStatus,
            },
          });

          await tx.paymentAllocation.create({
            data: {
              paymentVoucherId: newVoucher.id,
              billId: targetBill.id,
              partyId: party.id,
              amount: appliedAmount,
              createdById: params.userId,
            },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: "POST_PAYMENT",
        entityType: "Voucher",
        entityId: newVoucher.id,
        reason: `Paid Rs. ${params.amount} to ${party.name} via ${paidFromAccount.title}`,
      },
    });

    return newVoucher;
  });

  return voucher;
}

export async function getPartyStatement(partyId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) throw new Error("Party not found.");

  const bills = await prisma.bill.findMany({
    where: { partyId: party.id, status: "posted" },
    include: { lines: true },
    orderBy: { billDate: "asc" },
  });

  const vouchers = await prisma.voucher.findMany({
    where: { partyId: party.id, status: "posted" },
    orderBy: { transactionDate: "asc" },
  });

  interface StatementRow {
    id: string;
    date: Date;
    voucherNumber: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    mode?: string;
  }

  const rows: StatementRow[] = [];
  let runningBalance = 0;

  if (party.openingBalance > 0) {
    if (party.openingBalanceType === "payable") {
      runningBalance += party.openingBalance;
      rows.push({
        id: "opening-balance",
        date: party.createdAt,
        voucherNumber: "OP-BAL",
        type: "Opening Balance",
        description: "Initial balance brought forward (We need to pay)",
        debit: 0,
        credit: party.openingBalance,
        balance: runningBalance,
      });
    } else if (party.openingBalanceType === "receivable") {
      runningBalance -= party.openingBalance;
      rows.push({
        id: "opening-balance",
        date: party.createdAt,
        voucherNumber: "OP-BAL",
        type: "Opening Balance",
        description: "Initial advance / receivable brought forward",
        debit: party.openingBalance,
        credit: 0,
        balance: runningBalance,
      });
    }
  }

  const combined = [
    ...bills.map((b) => ({
      id: b.id,
      date: b.billDate,
      voucherNumber: b.billNumber,
      type: "Bill",
      description: b.lines.map((l) => l.description).join(", ") || "Purchase Bill",
      debit: 0,
      credit: b.totalAmount,
      mode: "Credit",
    })),
    ...vouchers
      .filter((v) => v.sourceType !== "bill")
      .map((v) => ({
        id: v.id,
        date: v.transactionDate,
        voucherNumber: v.voucherNumber,
        type: v.type,
        description: v.description,
        debit: v.totalAmount,
        credit: 0,
        mode: v.paymentMode || "Cash",
      })),
  ];

  combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const item of combined) {
    runningBalance += item.credit - item.debit;
    rows.push({
      ...item,
      balance: runningBalance,
    });
  }

  const totalBills = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = vouchers
    .filter((v) => v.sourceType !== "bill")
    .reduce((sum, v) => sum + v.totalAmount, 0);

  return {
    party: { ...party, _id: party.id },
    statement: rows,
    summary: {
      totalBills,
      totalPaid,
      currentPayableBalance: runningBalance,
      unpaidBillsCount: bills.filter((b) => b.paymentStatus !== "paid").length,
    },
    unpaidBills: bills.filter((b) => b.paymentStatus !== "paid").map((b) => ({ ...b, _id: b.id })),
  };
}
