import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { postBill } from "@/app/libs/accounting/postingService";
import { getSession } from "@/app/libs/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");
    const paymentStatus = searchParams.get("paymentStatus");

    const where: any = { status: "posted" };
    if (partyId) where.partyId = partyId;
    if (paymentStatus && paymentStatus !== "all") where.paymentStatus = paymentStatus;

    const rawBills = await prisma.bill.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, type: true, phone: true } },
        lines: {
          include: {
            account: { select: { id: true, code: true, title: true } },
          },
        },
      },
      orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
    });

    const bills = rawBills.map((b) => ({
      ...b,
      _id: b.id,
      partyId: b.party ? { ...b.party, _id: b.party.id } : null,
      lines: b.lines.map((l) => ({
        ...l,
        _id: l.id,
        accountId: l.account ? { ...l.account, _id: l.account.id } : null,
      })),
    }));

    return NextResponse.json({ success: true, data: bills });
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
      billDate,
      dueDate,
      supplierInvoiceNumber,
      billType,
      lines,
      subtotal,
      taxAmount,
      otherCharges,
      totalAmount,
      isPaidImmediately,
      paidFromAccountId,
      paymentMode,
      notes,
    } = body;

    if (!partyId || !lines || lines.length === 0 || !totalAmount) {
      return NextResponse.json(
        { success: false, error: "Party, line items, and total amount are required." },
        { status: 400 }
      );
    }

    const sanitizedLines = (lines || []).map((l: any) => ({
      ...l,
      quantity: Number(l.quantity) || 1,
      rate: Number(l.rate) || 0,
      amount: Number(l.amount) !== undefined && !isNaN(Number(l.amount)) ? Number(l.amount) : (Number(l.quantity) || 1) * (Number(l.rate) || 0),
    }));

    const bill = await postBill({
      partyId,
      billDate: billDate ? new Date(billDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      supplierInvoiceNumber,
      billType: billType || "purchase",
      lines: sanitizedLines,
      subtotal: Number(subtotal),
      taxAmount: Number(taxAmount || 0),
      otherCharges: Number(otherCharges || 0),
      totalAmount: Number(totalAmount),
      isPaidImmediately: Boolean(isPaidImmediately),
      paidFromAccountId,
      paymentMode,
      notes,
      userId: session.id,
      userName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: `Bill ${bill.billNumber} recorded successfully.`,
      data: { ...bill, _id: bill.id },
    });
  } catch (error: any) {
    console.error("Error creating bill:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
