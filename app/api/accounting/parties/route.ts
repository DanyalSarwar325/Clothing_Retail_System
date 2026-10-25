import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { getSession } from "@/app/libs/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
    if (type && type !== "all") {
      where.type = type;
    }

    const parties = await prisma.party.findMany({
      where,
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
        if (party.openingBalanceType === "payable") {
          initialBalance = party.openingBalance;
        } else if (party.openingBalanceType === "receivable" && party.type !== "worker") {
          initialBalance = -party.openingBalance;
        }

        let displayedTotalBills = totalBills;
        let netPayable = initialBalance + totalBills - totalPaid;

        if (party.type === "worker") {
          // Workers are paid only after completing work. Advances do not exist.
          displayedTotalBills = Math.max(totalBills, totalPaid);
          netPayable = Math.max(0, initialBalance + displayedTotalBills - totalPaid);
        }

        return {
          ...party,
          _id: party.id,
          totalBills: displayedTotalBills,
          totalPaid,
          netPayable,
          unpaidBillsCount: party.type === "worker" ? 0 : bills.filter((b) => b.paymentStatus !== "paid").length,
        };
      })
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    const { name, type, phone, address, notes, openingBalance, openingBalanceType } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: "Party name and party type are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.party.findFirst({
      where: {
        normalizedName: name.trim().toLowerCase(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Party with name "${name}" already exists.` },
        { status: 400 }
      );
    }

    const party = await prisma.party.create({
      data: {
        name: name.trim(),
        normalizedName: name.trim().toLowerCase(),
        type,
        phone: phone?.trim(),
        address: address?.trim(),
        notes: notes?.trim(),
        openingBalance: Number(openingBalance) || 0,
        openingBalanceType: openingBalanceType || "none",
        createdById: session?.id || undefined,
        status: "active",
      },
    });

    return NextResponse.json({
      success: true,
      message: `${party.name} added successfully.`,
      data: { ...party, _id: party.id },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
