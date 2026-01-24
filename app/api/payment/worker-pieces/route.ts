import { NextRequest, NextResponse } from "next/server";
import DbConnect from "@/app/libs/dbConnect";
import Barcode from "@/app/libs/models/barcode";
import FinalSticker from "@/app/libs/models/finalSticker";
import Rate from "@/app/libs/models/rate";

// Departments that use item-based rates (different rate per Qameez, Shalwar, Dupatta)
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Press"];

// Departments that use final stickers
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

// GET - Get all pieces for workers in a department grouped by worker and design
export async function GET(request: NextRequest) {
  try {
    await DbConnect();

    const department = request.nextUrl.searchParams.get("department");

    if (!department) {
      return NextResponse.json(
        { success: false, message: "department is required" },
        { status: 400 }
      );
    }

    // Get fallback rate for this department
    const rateDoc = await Rate.findOne({ department });
    const fallbackRate = rateDoc?.ratePerUnit || 0;

    // Check if this department uses final stickers
    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);
    
    // Check if this department uses item-based rates
    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    let pieces: any[] = [];

    if (usesFinalStickers) {
      // Query FinalSticker collection for Packing/Store
      pieces = await FinalSticker.aggregate([
        {
          $match: {
            "departmentHistory.department": department,
            status: { $nin: ["defective", "wasted"] },
          },
        },
        { $unwind: "$departmentHistory" },
        { $match: { "departmentHistory.department": department } },
        {
          $project: {
            _id: 1,
            design: 1,
            item: { $literal: "Final Sticker" },
            size: 1,
            suitType: 1,
            unitNumber: 1,
            workerName: "$departmentHistory.scannedBy",
            scannedAt: "$departmentHistory.scannedAt",
            departmentRates: 1,
            paidDepartments: 1,
            isPaid: {
              $cond: [
                { $isArray: "$paidDepartments" },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$paidDepartments",
                          as: "pd",
                          cond: { $eq: ["$$pd.department", department] },
                        },
                      },
                    },
                    0,
                  ],
                },
                false,
              ],
            },
            rate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: { $eq: ["$$r.department", department] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] },
              },
            },
          },
        },
        { $match: { workerName: { $ne: null } } },
        { $sort: { scannedAt: -1 } },
      ]);
    } else if (usesItemBasedRates) {
      // For Cutting, Sewing, Press - match rate by department AND item
      pieces = await Barcode.aggregate([
        {
          $match: {
            "departmentHistory.department": department,
            status: { $nin: ["defective", "wasted"] },
          },
        },
        { $unwind: "$departmentHistory" },
        { $match: { "departmentHistory.department": department } },
        {
          $project: {
            _id: 1,
            design: 1,
            item: 1,
            size: 1,
            suitType: 1,
            unitNumber: 1,
            workerName: "$departmentHistory.scannedBy",
            scannedAt: "$departmentHistory.scannedAt",
            departmentRates: 1,
            paidDepartments: 1,
            isPaid: {
              $cond: [
                { $isArray: "$paidDepartments" },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$paidDepartments",
                          as: "pd",
                          cond: { $eq: ["$$pd.department", department] },
                        },
                      },
                    },
                    0,
                  ],
                },
                false,
              ],
            },
            // For item-based departments, match by department AND item
            rate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: {
                            $and: [
                              { $eq: ["$$r.department", department] },
                              { $eq: ["$$r.item", "$item"] },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] },
              },
            },
          },
        },
        { $match: { workerName: { $ne: null } } },
        { $sort: { scannedAt: -1 } },
      ]);
    } else {
      // For other departments - single rate per piece
      pieces = await Barcode.aggregate([
        {
          $match: {
            "departmentHistory.department": department,
            status: { $nin: ["defective", "wasted"] },
          },
        },
        { $unwind: "$departmentHistory" },
        { $match: { "departmentHistory.department": department } },
        {
          $project: {
            _id: 1,
            design: 1,
            item: 1,
            size: 1,
            suitType: 1,
            unitNumber: 1,
            workerName: "$departmentHistory.scannedBy",
            scannedAt: "$departmentHistory.scannedAt",
            departmentRates: 1,
            paidDepartments: 1,
            isPaid: {
              $cond: [
                { $isArray: "$paidDepartments" },
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$paidDepartments",
                          as: "pd",
                          cond: { $eq: ["$$pd.department", department] },
                        },
                      },
                    },
                    0,
                  ],
                },
                false,
              ],
            },
            rate: {
              $let: {
                vars: {
                  matchedRate: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: { $ifNull: ["$departmentRates", []] },
                          as: "r",
                          cond: { $eq: ["$$r.department", department] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$matchedRate.ratePerPiece", fallbackRate] },
              },
            },
          },
        },
        { $match: { workerName: { $ne: null } } },
        { $sort: { scannedAt: -1 } },
      ]);
    }

    // Group pieces by worker
    const workerMap: Record<string, any> = {};
    
    for (const piece of pieces) {
      const workerName = piece.workerName;
      
      if (!workerMap[workerName]) {
        workerMap[workerName] = {
          workerName,
          totalPieces: 0,
          totalPaid: 0,
          totalPending: 0,
          paidAmount: 0,
          pendingAmount: 0,
          designs: {},
        };
      }
      
      const worker = workerMap[workerName];
      worker.totalPieces++;
      
      if (piece.isPaid) {
        worker.totalPaid++;
        worker.paidAmount += piece.rate;
      } else {
        worker.totalPending++;
        worker.pendingAmount += piece.rate;
      }
      
      // Group by design
      if (!worker.designs[piece.design]) {
        worker.designs[piece.design] = {
          design: piece.design,
          pieces: [],
          paidCount: 0,
          pendingCount: 0,
          paidAmount: 0,
          pendingAmount: 0,
        };
      }
      
      const designGroup = worker.designs[piece.design];
      designGroup.pieces.push({
        _id: piece._id,
        item: piece.item,
        size: piece.size,
        unitNumber: piece.unitNumber,
        rate: piece.rate,
        isPaid: piece.isPaid,
        scannedAt: piece.scannedAt,
      });
      
      if (piece.isPaid) {
        designGroup.paidCount++;
        designGroup.paidAmount += piece.rate;
      } else {
        designGroup.pendingCount++;
        designGroup.pendingAmount += piece.rate;
      }
    }

    // Convert to array format
    const workers = Object.values(workerMap).map((worker: any) => ({
      ...worker,
      designs: Object.values(worker.designs),
    }));

    // Sort workers by pending amount (highest first)
    workers.sort((a: any, b: any) => b.pendingAmount - a.pendingAmount);

    return NextResponse.json({
      success: true,
      data: {
        department,
        fallbackRate,
        workers,
        totals: {
          totalWorkers: workers.length,
          totalPieces: pieces.length,
          totalPaid: pieces.filter((p) => p.isPaid).length,
          totalPending: pieces.filter((p) => !p.isPaid).length,
          paidAmount: pieces.filter((p) => p.isPaid).reduce((sum, p) => sum + p.rate, 0),
          pendingAmount: pieces.filter((p) => !p.isPaid).reduce((sum, p) => sum + p.rate, 0),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching worker pieces:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch worker pieces" },
      { status: 500 }
    );
  }
}

// POST - Mark a piece as paid for a department
export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const { pieceId, department, paidBy } = await request.json();

    if (!pieceId || !department) {
      return NextResponse.json(
        { success: false, message: "pieceId and department are required" },
        { status: 400 }
      );
    }

    // Check if this department uses final stickers
    const usesFinalStickers = FINAL_STICKER_DEPARTMENTS.includes(department);
    
    // Check if this department uses item-based rates
    const usesItemBasedRates = ITEM_BASED_DEPARTMENTS.includes(department);

    // Get the piece from appropriate collection
    const Model = usesFinalStickers ? FinalSticker : Barcode;
    const piece = await Model.findById(pieceId);
    
    if (!piece) {
      return NextResponse.json(
        { success: false, message: "Piece not found" },
        { status: 404 }
      );
    }

    // Get the rate for this piece
    const rateDoc = await Rate.findOne({ department });
    const fallbackRate = rateDoc?.ratePerUnit || 0;
    
    let rate = fallbackRate;
    
    if (usesItemBasedRates) {
      // For Cutting, Sewing, Press - find rate matching department AND item
      const deptRate = piece.departmentRates?.find(
        (r: any) => r.department === department && r.item === piece.item
      );
      rate = deptRate?.ratePerPiece || fallbackRate;
    } else {
      // For other departments - find rate matching department only
      const deptRate = piece.departmentRates?.find((r: any) => r.department === department);
      rate = deptRate?.ratePerPiece || fallbackRate;
    }

    // Check if already paid
    const alreadyPaid = piece.paidDepartments?.some((pd: any) => pd.department === department);
    if (alreadyPaid) {
      return NextResponse.json(
        { success: false, message: "This piece is already paid for this department" },
        { status: 400 }
      );
    }

    // Mark as paid
    await Model.findByIdAndUpdate(pieceId, {
      $push: {
        paidDepartments: {
          department,
          paidAt: new Date(),
          paidBy: paidBy || "Admin",
          amount: rate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Piece marked as paid (₨${rate})`,
      amount: rate,
    });
  } catch (error: any) {
    console.error("Error marking piece as paid:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to mark piece as paid" },
      { status: 500 }
    );
  }
}
