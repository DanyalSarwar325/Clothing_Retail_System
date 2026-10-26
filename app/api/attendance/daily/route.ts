import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// GET /api/attendance/daily?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const todayStr = new Date().toISOString().split("T")[0];
    const date = searchParams.get("date") || todayStr;
    const department = searchParams.get("department");

    const year = parseInt(date.split("-")[0], 10);

    const whereClause: any = { isActive: true };
    if (department && department !== "all") {
      whereClause.department = department;
    }

    // 1. Fetch active employees
    const employees = await prisma.salariedEmployee.findMany({
      where: whereClause,
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: {
        attendanceLogs: {
          where: {
            date: {
              startsWith: `${year}-`,
            },
          },
        },
      },
    });

    // 2. Map employees with today's record and leave quota details
    let presentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;

    const rows = employees.map((emp) => {
      // Find today's record
      const todayRecord = emp.attendanceLogs.find((l) => l.date === date);

      // Calculate annual leave stats
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

      const status = todayRecord ? todayRecord.status : "UNMARKED";

      if (status === "PRESENT") presentCount++;
      else if (status === "HALF_DAY") halfDayCount++;
      else if (status === "PAID_LEAVE" || status === "UNPAID_LEAVE" || status === "LEAVE") leaveCount++;
      else if (status === "ABSENT") absentCount++;
      else unmarkedCount++;

      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        baseSalary: emp.baseSalary,
        biometricPin: emp.biometricPin,
        annualLeaveQuota: emp.annualLeaveQuota,
        paidLeavesUsed,
        unpaidLeavesUsed,
        remainingQuota,
        attendance: todayRecord
          ? {
              id: todayRecord.id,
              status: todayRecord.status,
              checkInTime: todayRecord.checkInTime,
              checkOutTime: todayRecord.checkOutTime,
              workingHours: todayRecord.workingHours,
              source: todayRecord.source,
              notes: todayRecord.notes,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalEmployees: employees.length,
        present: presentCount,
        halfDay: halfDayCount,
        leave: leaveCount,
        absent: absentCount,
        unmarked: unmarkedCount,
      },
      records: rows,
    });
  } catch (error: any) {
    console.error("GET /api/attendance/daily error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch daily attendance" },
      { status: 500 }
    );
  }
}

// POST /api/attendance/daily - Bulk or single update of attendance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, records } = body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, message: "Date and an array of attendance records are required" },
        { status: 400 }
      );
    }

    const year = parseInt(date.split("-")[0], 10);
    const notifications: string[] = [];

    // Process each record inside a transaction
    await prisma.$transaction(async (tx) => {
      for (const rec of records) {
        const { employeeId, status, notes, checkInTime, checkOutTime, workingHours, source = "MANUAL" } = rec;

        if (!employeeId || !status) continue;

        let finalStatus = status;

        // If status requested is generic "LEAVE" or "PAID_LEAVE":
        if (status === "LEAVE" || status === "PAID_LEAVE") {
          // Check annual leave quota for this employee
          const employee = await tx.salariedEmployee.findUnique({
            where: { id: employeeId },
            include: {
              attendanceLogs: {
                where: {
                  date: {
                    startsWith: `${year}-`,
                  },
                  status: {
                    in: ["PAID_LEAVE", "LEAVE"],
                  },
                  NOT: {
                    date, // Exclude today's date if already recorded
                  },
                },
              },
            },
          });

          if (employee) {
            const alreadyUsed = employee.attendanceLogs.length;
            if (alreadyUsed >= employee.annualLeaveQuota) {
              finalStatus = "UNPAID_LEAVE";
              notifications.push(
                `${employee.name} has exhausted their annual quota of ${employee.annualLeaveQuota} leaves. Marked as Unpaid Leave (Salary will be deducted).`
              );
            } else {
              finalStatus = "PAID_LEAVE";
            }
          }
        }

        // Upsert record for (employeeId, date)
        await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId,
              date,
            },
          },
          create: {
            employeeId,
            date,
            status: finalStatus,
            checkInTime: checkInTime ? new Date(checkInTime) : null,
            checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
            workingHours: workingHours ? parseFloat(workingHours) : null,
            source,
            notes: notes || null,
          },
          update: {
            status: finalStatus,
            checkInTime: checkInTime ? new Date(checkInTime) : undefined,
            checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
            workingHours: workingHours ? parseFloat(workingHours) : undefined,
            source,
            notes: notes !== undefined ? notes : undefined,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Attendance updated for ${records.length} employee(s) on ${date}`,
      notifications,
    });
  } catch (error: any) {
    console.error("POST /api/attendance/daily error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update daily attendance" },
      { status: 500 }
    );
  }
}
