import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        party: { select: { id: true, name: true, type: true, phone: true } },
        createdBy: { select: { id: true, name: true, username: true } },
      },
    });

    if (!voucher) {
      return NextResponse.json({ success: false, error: "Voucher not found" }, { status: 404 });
    }

    const journalEntry = await prisma.journalEntry.findUnique({
      where: { voucherId: voucher.id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, title: true, rootType: true } },
            party: { select: { id: true, name: true } },
          },
        },
      },
    });

    const formattedVoucher = {
      ...voucher,
      _id: voucher.id,
      partyId: voucher.party ? { ...voucher.party, _id: voucher.party.id } : null,
      createdBy: voucher.createdBy ? { ...voucher.createdBy, _id: voucher.createdBy.id } : null,
    };

    const formattedEntry = journalEntry
      ? {
          ...journalEntry,
          _id: journalEntry.id,
          lines: journalEntry.lines.map((l) => ({
            ...l,
            _id: l.id,
            accountId: l.account ? { ...l.account, _id: l.account.id } : null,
            partyId: l.party ? { ...l.party, _id: l.party.id } : null,
          })),
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        voucher: formattedVoucher,
        journalEntry: formattedEntry,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
