import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { ensureAccountingSeeded } from "@/app/libs/accounting/seedAccounting";

export async function POST() {
  try {
    const result = await ensureAccountingSeeded();
    const totalAccounts = await prisma.account.count();
    const rawFinancialYears = await prisma.financialYear.findMany({
      orderBy: { startDate: "desc" },
    });
    const financialYears = rawFinancialYears.map((y) => ({ ...y, _id: y.id }));

    return NextResponse.json({
      success: true,
      message: "Accounting department seeded successfully.",
      data: {
        activeFY: result.activeFY ? { ...result.activeFY, _id: result.activeFY.id } : null,
        totalAccounts,
        financialYears,
      },
    });
  } catch (error: any) {
    console.error("Accounting seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to seed accounting" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await ensureAccountingSeeded();
    const rawAccounts = await prisma.account.findMany({
      where: { status: "active" },
      orderBy: { code: "asc" },
    });
    const accounts = rawAccounts.map((a) => ({ ...a, _id: a.id }));

    const rawFinancialYears = await prisma.financialYear.findMany({
      orderBy: { startDate: "desc" },
    });
    const financialYears = rawFinancialYears.map((y) => ({ ...y, _id: y.id }));

    return NextResponse.json({
      success: true,
      data: {
        activeFY: result.activeFY ? { ...result.activeFY, _id: result.activeFY.id } : null,
        accounts,
        financialYears,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
