import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET /api/attendance/monthly?month=10&year=2026
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || (now.getMonth() + 1).toString(), 10);
    const year = parseInt(searchParams.get("year") || now.getFullYear().toString(), 10);
    const department = searchParams.get("department");

    const daysInMonth = new Date(year, month, 0).getDate();
    const formattedMonth = month.toString().padStart(2, "0");
    const monthPrefix = `${year}-${formattedMonth}-`;

    const whereClause: any = { isActive: true };
    if (department && department !== "all") {
      whereClause.department = department;
    }

    const employees = await prisma.salariedEmployee.findMany({
      where: whereClause,
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: {
        attendanceLogs: {
          where: {
            date: {
              startsWith: monthPrefix,
            },
          },
        },
      },
    });

    const matrix = employees.map((emp) => {
      let daysPresent = 0;
      let halfDays = 0;
      let paidLeaves = 0;
      let unpaidLeaves = 0;
      let absentDays = 0;

      const dailyMap: Record<number, string> = {};

      for (const log of emp.attendanceLogs) {
        const dayNumber = parseInt(log.date.split("-")[2], 10);
        dailyMap[dayNumber] = log.status;

        if (log.status === "PRESENT") daysPresent++;
        else if (log.status === "HALF_DAY") halfDays++;
        else if (log.status === "PAID_LEAVE" || log.status === "LEAVE") paidLeaves++;
        else if (log.status === "UNPAID_LEAVE") unpaidLeaves++;
        else if (log.status === "ABSENT") absentDays++;
      }

      // Total deduction days: unpaid leaves + unapproved absences + (half days * 0.5)
      const deductionDays = unpaidLeaves + absentDays + halfDays * 0.5;

      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        baseSalary: emp.baseSalary,
        annualLeaveQuota: emp.annualLeaveQuota,
        dailyMap,
        summary: {
          daysPresent,
          halfDays,
          paidLeaves,
          unpaidLeaves,
          absentDays,
          deductionDays,
        },
      };
    });

    return NextResponse.json({
      success: true,
      month,
      year,
      daysInMonth,
      employees: matrix,
    });
  } catch (error: any) {
    console.error("GET /api/attendance/monthly error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch monthly attendance" },
      { status: 500 }
    );
  }
}
