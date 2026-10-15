import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim();

    const where: any = {};
    if (type && type !== "all") where.type = type;
    if (search) {
      where.OR = [
        { voucherNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { referenceNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const rawVouchers = await prisma.voucher.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, type: true, phone: true } },
        createdBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });

    const vouchers = rawVouchers.map((v) => ({
      ...v,
      _id: v.id,
      partyId: v.party ? { ...v.party, _id: v.party.id } : null,
      createdBy: v.createdBy ? { ...v.createdBy, _id: v.createdBy.id } : null,
    }));

    return NextResponse.json({ success: true, data: vouchers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
