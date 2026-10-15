import { NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

export async function GET() {
  try {
    const barcodes = await prisma.barcode.findMany({
      select: {
        design: true,
        size: true,
        currentDepartment: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const designMap: Record<string, any> = {};
    const overallDeptCounts: Record<string, number> = {
      cutting: 0,
      sewing: 0,
      quality: 0,
      handmade: 0,
      addaWork: 0,
      patching: 0,
      press: 0,
      packing: 0,
      store: 0,
    };

    const mapDeptKey = (dept: string): string => {
      const lower = dept.toLowerCase();
      if (lower === "cutting") return "cutting";
      if (lower === "sewing") return "sewing";
      if (lower === "quality") return "quality";
      if (lower === "handmade") return "handmade";
      if (lower === "adda work" || lower === "addawork") return "addaWork";
      if (lower === "patching") return "patching";
      if (lower === "press") return "press";
      if (lower === "packing") return "packing";
      if (lower === "store") return "store";
      return "";
    };

    for (const b of barcodes) {
      if (!designMap[b.design]) {
        designMap[b.design] = {
          name: b.design,
          totalItems: 0,
          sizes: { small: 0, medium: 0, large: 0 },
          byDepartment: {
            cutting: 0,
            sewing: 0,
            quality: 0,
            handmade: 0,
            addaWork: 0,
            patching: 0,
            press: 0,
            packing: 0,
            store: 0,
          },
          createdAt: b.createdAt,
        };
      }

      const d = designMap[b.design];
      d.totalItems++;

      if (b.size === "S") d.sizes.small++;
      else if (b.size === "M") d.sizes.medium++;
      else if (b.size === "L") d.sizes.large++;

      const deptKey = mapDeptKey(b.currentDepartment);
      if (deptKey && d.byDepartment[deptKey] !== undefined) {
        d.byDepartment[deptKey]++;
        overallDeptCounts[deptKey]++;
      }
    }

    const designsList = Object.values(designMap);

    return NextResponse.json({
      success: true,
      stats: {
        totalDesigns: designsList.length,
        totalItems: barcodes.length,
        byDepartment: overallDeptCounts,
      },
      designs: designsList,
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
