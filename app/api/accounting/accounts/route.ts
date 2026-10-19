import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { ensureAccountingSeeded } from "@/app/libs/accounting/seedAccounting";

export type AccountRootType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "directExpense"
  | "indirectExpense";

export async function GET() {
  try {
    await ensureAccountingSeeded();

    const rawAccounts = await prisma.account.findMany({
      where: { status: "active" },
      orderBy: { code: "asc" },
    });

    const accounts = rawAccounts.map((a: any) => ({
      ...a,
      _id: a.id,
    }));

    const grouped = {
      directExpense: accounts.filter((a: any) => a.rootType === "directExpense"),
      indirectExpense: accounts.filter((a: any) => a.rootType === "indirectExpense"),
      asset: accounts.filter((a: any) => a.rootType === "asset"),
      liability: accounts.filter((a: any) => a.rootType === "liability"),
      revenue: accounts.filter((a: any) => a.rootType === "revenue"),
      equity: accounts.filter((a: any) => a.rootType === "equity"),
    };

    return NextResponse.json({ success: true, data: { all: accounts, grouped } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, rootType, code, accountRole, description } = body;

    if (!title || !rootType) {
      return NextResponse.json(
        { success: false, error: "Account title and main heading (root type) are required." },
        { status: 400 }
      );
    }

    let accountCode = code?.trim().toUpperCase();
    if (!accountCode) {
      const prefixMap: Record<AccountRootType, string> = {
        directExpense: "DE",
        indirectExpense: "IE",
        asset: "AS",
        liability: "LI",
        revenue: "RE",
        equity: "EQ",
      };
      const prefix = prefixMap[rootType as AccountRootType] || "AC";
      const count = await prisma.account.count({ where: { rootType } });
      accountCode = `${prefix}-${101 + count}`;
    }

    const existing = await prisma.account.findUnique({ where: { code: accountCode } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Account code "${accountCode}" is already in use.` },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        code: accountCode,
        title: title.trim(),
        rootType,
        accountRole: accountRole || "general",
        description: description?.trim(),
        isSystem: false,
        status: "active",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account head "${account.title}" (${account.code}) created successfully.`,
      data: { ...account, _id: account.id },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Account ID is required." },
        { status: 400 }
      );
    }

    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found." },
        { status: 404 }
      );
    }

    // Safety check: is account used in any journal or bill lines?
    const [hasJournal, hasBills] = await Promise.all([
      prisma.journalLine.findFirst({ where: { accountId: id } }),
      prisma.billLine.findFirst({ where: { accountId: id } }),
    ]);

    if (hasJournal || hasBills) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete "${account.title}" (${account.code}) because financial transactions have already been recorded against it.`,
        },
        { status: 400 }
      );
    }

    await prisma.account.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Account head "${account.title}" (${account.code}) deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
