import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { postPayment } from "@/app/libs/accounting/postingService";
import { getSession } from "@/app/libs/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    const where: any = {
      type: { in: ["CPV", "BPV"] },
      status: "posted",
    };
    if (partyId) where.partyId = partyId;

    const rawPayments = await prisma.voucher.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, type: true, phone: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });

    const payments = rawPayments.map((p) => ({
      ...p,
      _id: p.id,
      partyId: p.party ? { ...p.party, _id: p.party.id } : null,
    }));

    return NextResponse.json({ success: true, data: payments });
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

    const body = await request.json();

    const {
      partyId,
      paymentDate,
      amount,
      paidFromAccountId,
      paymentMode,
      referenceNumber,
      description,
      billAllocations,
    } = body;

    if (!partyId || !amount || !paidFromAccountId) {
      return NextResponse.json(
        { success: false, error: "Party, amount, and paid-from account are required." },
        { status: 400 }
      );
    }

    const voucher = await postPayment({
      partyId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount: Number(amount),
      paidFromAccountId,
      paymentMode: paymentMode || "cash",
      referenceNumber,
      description,
      billAllocations,
      userId: session.id,
      userName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: `Payment voucher ${voucher.voucherNumber} posted successfully.`,
      data: { ...voucher, _id: voucher.id },
    });
  } catch (error: any) {
    console.error("Error posting payment:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
