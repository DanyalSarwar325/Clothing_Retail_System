import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { ensureAccountingSeeded } from "@/app/libs/accounting/seedAccounting";
import { getSession } from "@/app/libs/auth";

export async function GET() {
  try {
    await ensureAccountingSeeded();

    const rawYears = await prisma.financialYear.findMany({
      orderBy: { startDate: "desc" },
    });
    const years = rawYears.map((y) => ({ ...y, _id: y.id }));
    return NextResponse.json({ success: true, data: years });
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
    const { startYear } = body;

    const sYear = Number(startYear);
    if (!sYear) {
      return NextResponse.json({ success: false, error: "Valid starting year required" }, { status: 400 });
    }

    const eYear = sYear + 1;
    const name = `FY ${sYear}-${String(eYear).slice(-2)}`;

    const existing = await prisma.financialYear.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ success: false, error: `${name} already exists` }, { status: 400 });
    }

    const newFY = await prisma.financialYear.create({
      data: {
        name,
        startDate: new Date(sYear, 6, 1), // 1 July
        endDate: new Date(eYear, 5, 30, 23, 59, 59), // 30 June
        status: "open",
        isCurrent: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Financial year ${name} created successfully.`,
      data: { ...newFY, _id: newFY.id },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
