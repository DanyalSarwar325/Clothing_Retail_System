import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET /api/attendance/employees - List all salaried employees with leave usage stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);
    const department = searchParams.get("department");

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
              startsWith: `${year}-`,
            },
            status: {
              in: ["PAID_LEAVE", "UNPAID_LEAVE", "LEAVE"],
            },
          },
        },
      },
    });

    const enrichedEmployees = employees.map((emp) => {
      let paidLeavesUsed = 0;
      let unpaidLeavesUsed = 0;

      for (const log of emp.attendanceLogs) {
        if (log.status === "PAID_LEAVE" || log.status === "LEAVE") {
          paidLeavesUsed += 1;
        } else if (log.status === "UNPAID_LEAVE") {
          unpaidLeavesUsed += 1;
        }
      }

      const remainingQuota = Math.max(0, emp.annualLeaveQuota - paidLeavesUsed);

      return {
        id: emp.id,
        biometricPin: emp.biometricPin,
        name: emp.name,
        phone: emp.phone,
        department: emp.department,
        designation: emp.designation,
        salaryType: emp.salaryType,
        baseSalary: emp.baseSalary,
        annualLeaveQuota: emp.annualLeaveQuota,
        joiningDate: emp.joiningDate,
        isActive: emp.isActive,
        year,
        paidLeavesUsed,
        unpaidLeavesUsed,
        totalLeavesUsed: paidLeavesUsed + unpaidLeavesUsed,
        remainingQuota,
      };
    });

    return NextResponse.json({ success: true, employees: enrichedEmployees });
  } catch (error: any) {
    console.error("GET /api/attendance/employees error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/employees - Create new salaried employee
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      department,
      designation,
      salaryType = "monthly",
      baseSalary,
      annualLeaveQuota = 14,
      biometricPin,
      joiningDate,
    } = body;

    if (!name || !designation || baseSalary === undefined || baseSalary === null) {
      return NextResponse.json(
        { success: false, message: "Name, designation, and base salary are required" },
        { status: 400 }
      );
    }

    // Check biometricPin uniqueness if provided
    if (biometricPin && biometricPin.trim()) {
      const existingPin = await prisma.salariedEmployee.findUnique({
        where: { biometricPin: biometricPin.trim() },
      });
      if (existingPin) {
        return NextResponse.json(
          { success: false, message: `Biometric PIN ${biometricPin} is already assigned to ${existingPin.name}` },
          { status: 400 }
        );
      }
    }

    const employee = await prisma.salariedEmployee.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        department: department?.trim() || "General",
        designation: designation.trim(),
        salaryType,
        baseSalary: parseFloat(baseSalary),
        annualLeaveQuota: parseInt(annualLeaveQuota, 10) || 14,
        biometricPin: biometricPin?.trim() || null,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.name} added successfully!`,
      employee,
    });
  } catch (error: any) {
    console.error("POST /api/attendance/employees error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create employee" },
      { status: 500 }
    );
  }
}

// PUT /api/attendance/employees - Update salaried employee
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      phone,
      department,
      designation,
      salaryType,
      baseSalary,
      annualLeaveQuota,
      biometricPin,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Employee ID is required" }, { status: 400 });
    }

    if (biometricPin && biometricPin.trim()) {
      const existingPin = await prisma.salariedEmployee.findFirst({
        where: {
          biometricPin: biometricPin.trim(),
          NOT: { id },
        },
      });
      if (existingPin) {
        return NextResponse.json(
          { success: false, message: `Biometric PIN ${biometricPin} is already assigned to ${existingPin.name}` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (department) updateData.department = department.trim();
    if (designation) updateData.designation = designation.trim();
    if (salaryType) updateData.salaryType = salaryType;
    if (baseSalary !== undefined) updateData.baseSalary = parseFloat(baseSalary);
    if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = parseInt(annualLeaveQuota, 10);
    if (biometricPin !== undefined) updateData.biometricPin = biometricPin?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.salariedEmployee.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${updated.name} updated successfully`,
      employee: updated,
    });
  } catch (error: any) {
    console.error("PUT /api/attendance/employees error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update employee" },
      { status: 500 }
    );
  }
}
