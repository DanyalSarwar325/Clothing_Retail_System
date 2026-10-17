import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { getSession } from "@/app/libs/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const searchParams = request.nextUrl.searchParams;
    const requestedUser = searchParams.get("userName")?.trim();
    const targetDesign = searchParams.get("design")?.trim();

    const targetUser = requestedUser || session?.name || session?.username;

    // Get available workers who have scanned in Sewing (useful for Admin view)
    let availableWorkers: string[] = [];
    if (session?.role === "admin" || !targetUser) {
      const distinctScans = await prisma.barcodeScan.findMany({
        where: { department: "Sewing", scannedBy: { not: null } },
        select: { scannedBy: true },
        distinct: ["scannedBy"],
      });
      availableWorkers = distinctScans
        .map((s) => s.scannedBy!)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }

    const workerToQuery = targetUser || (availableWorkers.length > 0 ? availableWorkers[0] : null);

    if (!workerToQuery) {
      return NextResponse.json({
        success: true,
        data: {
          workerName: "",
          availableWorkers,
          items: [],
          summary: {
            totalDue: 0,
            paid: 0,
            pending: 0,
            totalScans: 0,
            scannedToday: 0,
          },
          byDesign: [],
        },
      });
    }

    const rateDoc = await prisma.rate.findUnique({ where: { department: "Sewing" } });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    const scans = await prisma.barcodeScan.findMany({
      where: {
        department: "Sewing",
        scannedBy: { equals: workerToQuery, mode: "insensitive" },
        ...(targetDesign && targetDesign !== "all"
          ? { barcode: { design: { equals: targetDesign, mode: "insensitive" } } }
          : {}),
      },
      include: {
        barcode: {
          include: {
            departmentRates: { where: { department: "Sewing" } },
            paidDepartments: { where: { department: "Sewing" } },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let totalDue = 0;
    let paidTotal = 0;
    let pendingTotal = 0;
    let scannedTodayCount = 0;

    const designMap: Record<
      string,
      { count: number; totalAmount: number; paidAmount: number; pendingAmount: number }
    > = {};

    const items = scans.map((scan) => {
      const b = scan.barcode;
      const itemMatch = b.departmentRates.find((r) => r.item === b.item);
      const deptMatch = b.departmentRates.find((r) => r.department === "Sewing");
      const rate = itemMatch?.ratePerPiece ?? deptMatch?.ratePerPiece ?? fallbackRate;

      const isPaid = b.paidDepartments.length > 0;
      const paidInfo = b.paidDepartments[0];

      const scanDate = new Date(scan.scannedAt);
      const isToday = scanDate >= startOfToday;

      totalDue += rate;
      if (isPaid) {
        paidTotal += rate;
      } else {
        pendingTotal += rate;
      }
      if (isToday) {
        scannedTodayCount++;
      }

      const d = b.design || "General";
      if (!designMap[d]) {
        designMap[d] = { count: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 };
      }
      designMap[d].count += 1;
      designMap[d].totalAmount += rate;
      if (isPaid) {
        designMap[d].paidAmount += rate;
      } else {
        designMap[d].pendingAmount += rate;
      }

      let extractedPo = b.poNumber || "";
      if (b.barcodeData && b.barcodeData.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(b.barcodeData);
          extractedPo = parsed.po || parsed.poNumber || extractedPo;
        } catch {
          // ignore parse error
        }
      }
      if (!extractedPo) {
        extractedPo = b.barcodeData;
      }

      return {
        id: scan.id,
        barcodeId: b.id,
        barcodeData: b.barcodeData,
        poNumber: extractedPo,
        design: b.design,
        item: b.item,
        size: b.size,
        suitType: b.suitType,
        unitNumber: b.unitNumber,
        scannedAt: scan.scannedAt,
        amount: rate,
        isPaid,
        paidAt: paidInfo?.paidAt || null,
        paidBy: paidInfo?.paidBy || null,
        status: b.status,
      };
    });

    const byDesign = Object.entries(designMap)
      .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
      .map(([design, stat]) => ({
        design,
        count: stat.count,
        totalAmount: stat.totalAmount,
        paidAmount: stat.paidAmount,
        pendingAmount: stat.pendingAmount,
        percentage: totalDue > 0 ? (stat.totalAmount / totalDue) * 100 : 0,
      }));

    return NextResponse.json({
      success: true,
      data: {
        workerName: workerToQuery,
        availableWorkers,
        items,
        summary: {
          totalDue,
          paid: paidTotal,
          pending: pendingTotal,
          totalScans: items.length,
          scannedToday: scannedTodayCount,
        },
        byDesign,
      },
    });
  } catch (error: any) {
    console.error("Error fetching sewing scanned items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch scanned items" },
      { status: 500 }
    );
  }
}
