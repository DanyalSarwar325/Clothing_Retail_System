import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { getActiveFinancialYear, VoucherType } from "@/app/libs/accounting/postingService";
import { generateSequenceNumber } from "@/app/libs/accounting/voucherNumberService";
import { getSession } from "@/app/libs/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    const where: any = {
      type: { in: ["CRV", "BRV"] },
      status: "posted",
    };
    if (partyId) where.partyId = partyId;

    const rawReceipts = await prisma.voucher.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, type: true, phone: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });

    const receipts = rawReceipts.map((r) => ({
      ...r,
      _id: r.id,
      partyId: r.party ? { ...r.party, _id: r.party.id } : null,
    }));

    return NextResponse.json({ success: true, data: receipts });
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
      partyId,
      receiptDate,
      amount,
      depositAccountId,
      creditAccountId,
      paymentMode,
      referenceNumber,
      description,
    } = body;

    const receiptAmount = Number(amount);
    if (!receiptAmount || receiptAmount <= 0) {
      return NextResponse.json({ success: false, error: "Valid amount required" }, { status: 400 });
    }

    const depositAccount = await prisma.account.findUnique({
      where: { id: depositAccountId },
    });
    if (!depositAccount) {
      return NextResponse.json({ success: false, error: "Deposit cash/bank account not found" }, { status: 400 });
    }

    let party = null;
    if (partyId) {
      party = await prisma.party.findUnique({ where: { id: partyId } });
    }

    let targetCreditAccount = null;
    if (creditAccountId) {
      targetCreditAccount = await prisma.account.findUnique({ where: { id: creditAccountId } });
    }
    if (!targetCreditAccount) {
      targetCreditAccount = await prisma.account.findFirst({
        where: { accountRole: "accountsReceivable", status: "active" },
      });
    }
    if (!targetCreditAccount) {
      targetCreditAccount = await prisma.account.findFirst({
        where: { rootType: "revenue", status: "active" },
      });
    }
    if (!targetCreditAccount) {
      throw new Error("Target credit account not found.");
    }

    const voucherType: VoucherType = paymentMode === "cash" ? "CRV" : "BRV";
    const txDate = receiptDate ? new Date(receiptDate) : new Date();
    const voucherNumber = await generateSequenceNumber(voucherType, txDate);

    const voucher = await prisma.$transaction(async (tx) => {
      const newVoucher = await tx.voucher.create({
        data: {
          voucherNumber,
          type: voucherType,
          transactionDate: txDate,
          financialYearId: fy.id,
          partyId: party ? party.id : undefined,
          sourceType: "customer_payment",
          description: description || `Money received ${party ? `from ${party.name}` : ""}`,
          totalAmount: receiptAmount,
          paymentMode: paymentMode || "cash",
          referenceNumber,
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
          transactionDate: txDate,
          description: description || `Receipt of Rs. ${receiptAmount} from ${party ? party.name : "Customer"}`,
          totalDebit: receiptAmount,
          totalCredit: receiptAmount,
          status: "posted",
          lines: {
            create: [
              {
                accountId: depositAccount.id,
                partyId: party ? party.id : undefined,
                debit: receiptAmount,
                credit: 0,
                description: `Deposited into ${depositAccount.title}`,
              },
              {
                accountId: targetCreditAccount!.id,
                partyId: party ? party.id : undefined,
                debit: 0,
                credit: receiptAmount,
                description: `Received ${party ? `from ${party.name}` : ""}`,
              },
            ],
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          userName: session.name,
          action: "POST_RECEIPT",
          entityType: "Voucher",
          entityId: newVoucher.id,
          reason: `Received Rs. ${receiptAmount} from ${party ? party.name : "Customer"} into ${depositAccount.title}`,
        },
      });

      return newVoucher;
    });

    return NextResponse.json({
      success: true,
      message: `Receipt voucher ${voucher.voucherNumber} recorded successfully.`,
      voucher: { ...voucher, _id: voucher.id },
    });
  } catch (error: any) {
    console.error("Receipt error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
