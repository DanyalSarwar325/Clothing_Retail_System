import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Payment from "@/app/libs/models/payment";
import User from "@/app/libs/models/user";

const DEPARTMENTS = [
  "Cutting",
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
  scansByDesign: { design: string; count: number }[]; // Total scans by design
}

export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const searchParams = request.nextUrl.searchParams;
    const filterDepartment = searchParams.get("department");
    const filterName = searchParams.get("name");
    const filterDesign = searchParams.get("design");
    const filterDateFrom = searchParams.get("dateFrom");
    const filterDateTo = searchParams.get("dateTo");

    // Get all users (workers)
    const users = await User.find({ role: { $ne: "admin" } });

    const reports: WorkerReport[] = [];

    // Calculate date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    for (const user of users) {
      const userName = user.name;
      const userDepartment = user.department;

      // Apply department filter
      if (filterDepartment && userDepartment !== filterDepartment) {
        continue;
      }

      // Apply name filter
      if (filterName && !userName.toLowerCase().includes(filterName.toLowerCase())) {
        continue;
      }

      // Build date filter for scans
      const dateFilter: any = {};
      if (filterDateFrom) {
        dateFilter.$gte = new Date(filterDateFrom);
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }

      // Get all barcodes where this user has scanned
      const matchStage: any = {
        "departmentHistory.scannedBy": userName,
      };

      if (filterDesign) {
        matchStage.design = { $regex: filterDesign, $options: "i" };
      }

      // For Store department, only query FinalSticker (Store only handles final stickers)
      // For other departments, query Barcode
      let currentPieces = 0;
      let piecesByDesign: { design: string; count: number }[] = [];

      if (userDepartment === "Store") {
        // Store only handles final stickers
        const finalStickerPiecesAgg = await FinalSticker.aggregate([
          { $match: filterDesign ? { design: { $regex: filterDesign, $options: "i" } } : {} },
          { $addFields: { lastScan: { $arrayElemAt: ["$departmentHistory", -1] } } },
          { $match: { "lastScan.scannedBy": userName } },
          {
            $group: {
              _id: "$design",
              count: { $sum: 1 },
            },
          },
        ]);

        currentPieces = finalStickerPiecesAgg.reduce((sum: number, d: any) => sum + d.count, 0);
        piecesByDesign = finalStickerPiecesAgg.map((d: any) => ({
          design: d._id,
          count: d.count,
        }));
      } else {
        // Other departments handle individual barcodes
        const currentPiecesAgg = await Barcode.aggregate([
          { $match: filterDesign ? { design: { $regex: filterDesign, $options: "i" } } : {} },
          { $addFields: { lastScan: { $arrayElemAt: ["$departmentHistory", -1] } } },
          { $match: { "lastScan.scannedBy": userName } },
          {
            $group: {
              _id: "$design",
              count: { $sum: 1 },
            },
          },
        ]);

        currentPieces = currentPiecesAgg.reduce((sum: number, d: any) => sum + d.count, 0);
        piecesByDesign = currentPiecesAgg.map((d: any) => ({
          design: d._id,
          count: d.count,
        }));
      }

      // Get total scans by this user
      let totalScans = 0;
      let scansToday = 0;
      let scansThisWeek = 0;

      if (userDepartment === "Store") {
        // Store only handles final stickers
        const finalStickerScansAgg = await FinalSticker.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              ...(Object.keys(dateFilter).length > 0
                ? { "departmentHistory.scannedAt": dateFilter }
                : {}),
            },
          },
          { $count: "total" },
        ]);
        totalScans = finalStickerScansAgg[0]?.total || 0;

        // Get FinalSticker scans today
        const finalStickerScansTodayAgg = await FinalSticker.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.scannedAt": { $gte: todayStart },
            },
          },
          { $count: "total" },
        ]);
        scansToday = finalStickerScansTodayAgg[0]?.total || 0;

        // Get FinalSticker scans this week
        const finalStickerScansWeekAgg = await FinalSticker.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.scannedAt": { $gte: weekStart },
            },
          },
          { $count: "total" },
        ]);
        scansThisWeek = finalStickerScansWeekAgg[0]?.total || 0;
      } else {
        // Other departments handle individual barcodes
        const totalScansAgg = await Barcode.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              ...(Object.keys(dateFilter).length > 0
                ? { "departmentHistory.scannedAt": dateFilter }
                : {}),
            },
          },
          { $count: "total" },
        ]);
        totalScans = totalScansAgg[0]?.total || 0;

        // Get scans today
        const scansTodayAgg = await Barcode.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.scannedAt": { $gte: todayStart },
            },
          },
          { $count: "total" },
        ]);
        scansToday = scansTodayAgg[0]?.total || 0;

        // Get scans this week
        const scansWeekAgg = await Barcode.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.scannedAt": { $gte: weekStart },
            },
          },
          { $count: "total" },
        ]);
        scansThisWeek = scansWeekAgg[0]?.total || 0;
      }

      // Get scans by design for this user's department (this week)
      let scansByDesign: { design: string; count: number }[] = [];

      if (userDepartment === "Packing" || userDepartment === "Store") {
        // For Packing and Store, query FinalSticker
        const scansByDesignAgg = await FinalSticker.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.department": userDepartment,
              "departmentHistory.scannedAt": { $gte: weekStart },
            },
          },
          {
            $group: {
              _id: "$design",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]);
        scansByDesign = scansByDesignAgg.map((d: any) => ({
          design: d._id,
          count: d.count,
        }));
      } else {
        // For other departments, query Barcode
        const scansByDesignAgg = await Barcode.aggregate([
          { $match: matchStage },
          { $unwind: "$departmentHistory" },
          {
            $match: {
              "departmentHistory.scannedBy": userName,
              "departmentHistory.department": userDepartment,
              "departmentHistory.scannedAt": { $gte: weekStart },
            },
          },
          {
            $group: {
              _id: "$design",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]);
        scansByDesign = scansByDesignAgg.map((d: any) => ({
          design: d._id,
          count: d.count,
        }));
      }

      // Calculate total earned (based on design-specific rates)
      const earningsAgg = await Barcode.aggregate([
        { $match: matchStage },
        { $unwind: "$departmentHistory" },
        {
          $match: {
            "departmentHistory.scannedBy": userName,
            "departmentHistory.department": userDepartment,
            ...(Object.keys(dateFilter).length > 0
              ? { "departmentHistory.scannedAt": dateFilter }
              : {}),
          },
        },
        {
          $project: {
            designRate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "rate",
                          cond: { $eq: ["$$rate.department", userDepartment] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", 0] },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: "$designRate" },
          },
        },
      ]);
      const totalEarned = earningsAgg[0]?.totalEarned || 0;

      // Get total paid to this user
      const paymentsAgg = await Payment.aggregate([
        {
          $match: {
            $or: [{ userName: userName }, { createdFor: userName }],
            department: userDepartment,
          },
        },
        { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
      ]);
      const totalPaid = paymentsAgg[0]?.totalPaid || 0;

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

    // Sort by department, then by name
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
