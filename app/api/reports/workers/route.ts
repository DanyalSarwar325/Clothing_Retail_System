import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

const DEPARTMENTS = [
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

interface WorkerReport {
  name: string;
  department: string;
  currentPieces: number;
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  totalEarned: number;
  totalPaid: number;
  pendingPayment: number;
  piecesByDesign: { design: string; count: number }[];
  scansByDesign: { design: string; count: number }[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filterDepartment = searchParams.get("department");
    const filterName = searchParams.get("name");
    const filterDesign = searchParams.get("design");
    const filterDateFrom = searchParams.get("dateFrom");
    const filterDateTo = searchParams.get("dateTo");

    const users = await prisma.user.findMany({
      where: { role: { not: "admin" } },
    });

    const reports: WorkerReport[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    for (const user of users) {
      const userName = user.name;
      const userDepartment = user.department || "General";

      if (filterDepartment && userDepartment !== filterDepartment) {
        continue;
      }

      if (filterName && !userName.toLowerCase().includes(filterName.toLowerCase())) {
        continue;
      }

      const dateFilter: any = {};
      if (filterDateFrom) {
        dateFilter.gte = new Date(filterDateFrom);
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }

      let currentPieces = 0;
      let piecesByDesign: { design: string; count: number }[] = [];
      let totalScans = 0;
      let scansToday = 0;
      let scansThisWeek = 0;
      let scansByDesign: { design: string; count: number }[] = [];
      let totalEarned = 0;

      if (userDepartment === "Store" || userDepartment === "Packing") {
        const stickers = await prisma.finalSticker.findMany({
          where: filterDesign ? { design: { contains: filterDesign, mode: "insensitive" } } : {},
          include: {
            departmentHistory: { orderBy: { scannedAt: "asc" } },
            departmentRates: true,
          },
        });

        const piecesDesignMap: Record<string, number> = {};
        const scansDesignMap: Record<string, number> = {};

        for (const s of stickers) {
          const history = s.departmentHistory;
          const lastScan = history[history.length - 1];
          if (lastScan && lastScan.scannedBy === userName) {
            piecesDesignMap[s.design] = (piecesDesignMap[s.design] || 0) + 1;
            currentPieces++;
          }

          const userScans = history.filter((h) => h.scannedBy === userName);
          for (const scan of userScans) {
            const scanTime = new Date(scan.scannedAt);
            let inDateRange = true;
            if (dateFilter.gte && scanTime < dateFilter.gte) inDateRange = false;
            if (dateFilter.lte && scanTime > dateFilter.lte) inDateRange = false;

            if (inDateRange) {
              totalScans++;
            }
            if (scanTime >= todayStart) {
              scansToday++;
            }
            if (scanTime >= weekStart) {
              scansThisWeek++;
              if (scan.department === userDepartment) {
                scansDesignMap[s.design] = (scansDesignMap[s.design] || 0) + 1;
              }
            }

            if (scan.department === userDepartment && inDateRange) {
              const matchedRate = s.departmentRates.find((r) => r.department === userDepartment);
              totalEarned += matchedRate?.ratePerPiece || 0;
            }
          }
        }

        piecesByDesign = Object.entries(piecesDesignMap).map(([design, count]) => ({ design, count }));
        scansByDesign = Object.entries(scansDesignMap)
          .map(([design, count]) => ({ design, count }))
          .sort((a, b) => b.count - a.count);
      } else {
        const barcodes = await prisma.barcode.findMany({
          where: filterDesign ? { design: { contains: filterDesign, mode: "insensitive" } } : {},
          include: {
            departmentHistory: { orderBy: { scannedAt: "asc" } },
            departmentRates: true,
          },
        });

        const piecesDesignMap: Record<string, number> = {};
        const scansDesignMap: Record<string, number> = {};

        for (const b of barcodes) {
          const history = b.departmentHistory;
          const lastScan = history[history.length - 1];
          if (lastScan && lastScan.scannedBy === userName) {
            piecesDesignMap[b.design] = (piecesDesignMap[b.design] || 0) + 1;
            currentPieces++;
          }

          const userScans = history.filter((h) => h.scannedBy === userName);
          for (const scan of userScans) {
            const scanTime = new Date(scan.scannedAt);
            let inDateRange = true;
            if (dateFilter.gte && scanTime < dateFilter.gte) inDateRange = false;
            if (dateFilter.lte && scanTime > dateFilter.lte) inDateRange = false;

            if (inDateRange) {
              totalScans++;
            }
            if (scanTime >= todayStart) {
              scansToday++;
            }
            if (scanTime >= weekStart) {
              scansThisWeek++;
              if (scan.department === userDepartment) {
                scansDesignMap[b.design] = (scansDesignMap[b.design] || 0) + 1;
              }
            }

            if (scan.department === userDepartment && inDateRange) {
              const itemMatch = b.departmentRates.find(
                (r) => r.department === userDepartment && r.item === b.item
              );
              const deptMatch = b.departmentRates.find((r) => r.department === userDepartment);
              totalEarned += itemMatch?.ratePerPiece ?? deptMatch?.ratePerPiece ?? 0;
            }
          }
        }

        piecesByDesign = Object.entries(piecesDesignMap).map(([design, count]) => ({ design, count }));
        scansByDesign = Object.entries(scansDesignMap)
          .map(([design, count]) => ({ design, count }))
          .sort((a, b) => b.count - a.count);
      }

      const payouts = await prisma.workerPayoutRecord.findMany({
        where: {
          workerName: userName,
          department: userDepartment,
        },
      });
      const totalPaid = payouts.reduce((sum, p) => sum + p.amount, 0);
      const pendingPayment = Math.max(totalEarned - totalPaid, 0);

      reports.push({
        name: userName,
        department: userDepartment,
        currentPieces,
        totalScans,
        scansToday,
        scansThisWeek,
        totalEarned,
        totalPaid,
        pendingPayment,
        piecesByDesign,
        scansByDesign,
      });
    }

    reports.sort((a, b) => {
      if (a.department !== b.department) {
        return DEPARTMENTS.indexOf(a.department) - DEPARTMENTS.indexOf(b.department);
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: reports,
      filters: {
        department: filterDepartment,
        name: filterName,
        design: filterDesign,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
      },
    });
  } catch (error: any) {
    console.error("Error generating worker report:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
