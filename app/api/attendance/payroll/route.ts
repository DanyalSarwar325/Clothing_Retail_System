import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET /api/attendance/payroll?month=10&year=2026&workingDays=26
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || (now.getMonth() + 1).toString(), 10);
    const year = parseInt(searchParams.get("year") || now.getFullYear().toString(), 10);
    const workingDays = parseInt(searchParams.get("workingDays") || "26", 10);
    const department = searchParams.get("department");

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
        salarySlips: {
          where: {
            month,
            year,
          },
        },
      },
    });

    let totalGrossPayroll = 0;
    let totalDeductions = 0;
    let totalNetPayroll = 0;

    const payrollList = employees.map((emp) => {
      let daysPresent = 0;
      let halfDays = 0;
      let paidLeaves = 0;
      let unpaidLeaves = 0;
      let absentDays = 0;

      for (const log of emp.attendanceLogs) {
        if (log.status === "PRESENT") daysPresent++;
        else if (log.status === "HALF_DAY") halfDays++;
        else if (log.status === "PAID_LEAVE" || log.status === "LEAVE") paidLeaves++;
        else if (log.status === "UNPAID_LEAVE") unpaidLeaves++;
        else if (log.status === "ABSENT") absentDays++;
      }

      const deductionDays = unpaidLeaves + absentDays + halfDays * 0.5;
      const dailyRate = Math.round((emp.baseSalary / workingDays) * 100) / 100;
      const deductionAmount = Math.round(deductionDays * dailyRate);
      const netSalary = Math.max(0, Math.round(emp.baseSalary - deductionAmount));

      totalGrossPayroll += emp.baseSalary;
      totalDeductions += deductionAmount;
      totalNetPayroll += netSalary;

      const existingSlip = emp.salarySlips[0] || null;

      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        salaryType: emp.salaryType,
        baseSalary: emp.baseSalary,
        annualLeaveQuota: emp.annualLeaveQuota,
        totalWorkingDays: workingDays,
        daysPresent,
        halfDays,
        paidLeaves,
        unpaidLeaves,
        absentDays,
        deductionDays,
        dailyRate,
        deductionAmount,
        netSalary,
        slipStatus: existingSlip ? existingSlip.status : "UNPAID",
        paidAt: existingSlip?.paidAt || null,
        paidBy: existingSlip?.paidBy || null,
        paymentMethod: existingSlip?.paymentMethod || null,
        paymentVoucherId: existingSlip?.paymentVoucherId || null,
      };
    });

    return NextResponse.json({
      success: true,
      month,
      year,
      workingDays,
      summary: {
        totalEmployees: employees.length,
        totalGrossPayroll,
        totalDeductions,
        totalNetPayroll,
      },
      payroll: payrollList,
    });
  } catch (error: any) {
    console.error("GET /api/attendance/payroll error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to calculate payroll" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/payroll - Record Salary Payment & Post Voucher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId,
      month,
      year,
      totalWorkingDays = 26,
      daysPresent = 0,
      paidLeaves = 0,
      unpaidLeaves = 0,
      absentDays = 0,
      baseSalary,
      dailyRate,
      deductionAmount = 0,
      netSalary,
      paymentMethod = "cash",
      paidBy = "Admin",
      notes,
    } = body;

    if (!employeeId || !month || !year || baseSalary === undefined || netSalary === undefined) {
      return NextResponse.json(
        { success: false, message: "Missing required salary details" },
        { status: 400 }
      );
    }

    const employee = await prisma.salariedEmployee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    // 1. Upsert SalarySlip
    const salarySlip = await prisma.salarySlip.upsert({
      where: {
        employeeId_month_year: {
          employeeId,
          month: parseInt(month, 10),
          year: parseInt(year, 10),
        },
      },
      create: {
        employeeId,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        totalWorkingDays: parseInt(totalWorkingDays, 10),
        daysPresent: parseFloat(daysPresent),
        paidLeaves: parseFloat(paidLeaves),
        unpaidLeaves: parseFloat(unpaidLeaves),
        absentDays: parseFloat(absentDays),
        baseSalary: parseFloat(baseSalary),
        dailyRate: parseFloat(dailyRate),
        deductionAmount: parseFloat(deductionAmount),
        netSalary: parseFloat(netSalary),
        status: "PAID",
        paymentMethod,
        paidAt: new Date(),
        paidBy,
      },
      update: {
        totalWorkingDays: parseInt(totalWorkingDays, 10),
        daysPresent: parseFloat(daysPresent),
        paidLeaves: parseFloat(paidLeaves),
        unpaidLeaves: parseFloat(unpaidLeaves),
        absentDays: parseFloat(absentDays),
        baseSalary: parseFloat(baseSalary),
        dailyRate: parseFloat(dailyRate),
        deductionAmount: parseFloat(deductionAmount),
        netSalary: parseFloat(netSalary),
        status: "PAID",
        paymentMethod,
        paidAt: new Date(),
        paidBy,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Salary of Rs. ${netSalary.toLocaleString()} marked as PAID for ${employee.name}`,
      salarySlip,
    });
  } catch (error: any) {
    console.error("POST /api/attendance/payroll error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process salary payment" },
      { status: 500 }
    );
  }
}
