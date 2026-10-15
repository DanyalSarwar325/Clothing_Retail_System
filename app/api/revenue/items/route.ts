import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET(request: NextRequest) {
  try {
    const rawItems = await prisma.finalSticker.findMany({
      where: {
        status: { in: ["dispatched", "delivered"] },
      },
      include: {
        departmentHistory: true,
        departmentRates: true,
        paidDepartments: true,
      },
      orderBy: [
        { status: "asc" },
        { updatedAt: "desc" },
      ],
    });

    const items = rawItems.map((s) => ({
      ...s,
      _id: s.id,
      departmentHistory: s.departmentHistory.map((h) => ({
        _id: h.id,
        department: h.department,
        scannedAt: h.scannedAt,
        scannedBy: h.scannedBy,
      })),
      departmentRates: s.departmentRates.map((r) => ({
        _id: r.id,
        department: r.department,
        ratePerPiece: r.ratePerPiece,
      })),
      paidDepartments: s.paidDepartments.map((p) => ({
        _id: p.id,
        department: p.department,
        amount: p.amount,
        paidAt: p.paidAt,
        paidBy: p.paidBy,
      })),
    }));

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: any) {
    console.error("Error fetching revenue items:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch items" },
      { status: 500 }
    );
  }
}
