import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";

// POST /api/attendance/webhook - Receives biometric attendance logs (JSON or ZKT ADMS text)
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 1. Handle JSON payload (e.g. from local bridge script or REST webhook)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const logs = Array.isArray(body.logs) ? body.logs : [body];

      let processedCount = 0;

      for (const log of logs) {
        const { biometricPin, timestamp, punchType, verifyType, deviceSn } = log;
        if (!biometricPin || !timestamp) continue;

        const scanDate = new Date(timestamp);
        const dateStr = scanDate.toISOString().split("T")[0]; // YYYY-MM-DD

        // Find employee by biometric PIN
        const employee = await prisma.salariedEmployee.findUnique({
          where: { biometricPin: String(biometricPin).trim() },
        });

        if (!employee) continue;

        // Determine check-in vs check-out time
        const existing = await prisma.attendanceRecord.findUnique({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: dateStr,
            },
          },
        });

        if (existing) {
          // If first check-in already recorded, update check-out time
          await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              checkOutTime: scanDate,
              source: "BIOMETRIC",
            },
          });
        } else {
          // New record for today -> Mark PRESENT
          await prisma.attendanceRecord.create({
            data: {
              employeeId: employee.id,
              date: dateStr,
              status: "PRESENT",
              checkInTime: scanDate,
              source: "BIOMETRIC",
              notes: `Biometric scan (${verifyType || "Fingerprint"}) from device ${deviceSn || ""}`.trim(),
            },
          });
        }

        processedCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${processedCount} biometric scan(s)`,
      });
    }

    // 2. Handle ZKT ADMS raw tab-separated text payload (POST /iclock/cdata)
    const rawText = await req.text();
    const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      // Format: PIN \t YYYY-MM-DD HH:mm:ss \t status \t verify_type
      const parts = line.split("\t");
      if (parts.length < 2) continue;

      const pin = parts[0].trim();
      const timeStr = parts[1].trim();
      const scanDate = new Date(timeStr);
      if (isNaN(scanDate.getTime())) continue;

      const dateStr = scanDate.toISOString().split("T")[0];

      const employee = await prisma.salariedEmployee.findUnique({
        where: { biometricPin: pin },
      });

      if (!employee) continue;

      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: dateStr,
          },
        },
        create: {
          employeeId: employee.id,
          date: dateStr,
          status: "PRESENT",
          checkInTime: scanDate,
          source: "BIOMETRIC",
          notes: "Auto-synced from ZKTeco Biometric Machine",
        },
        update: {
          checkOutTime: scanDate,
          source: "BIOMETRIC",
        },
      });
    }

    // ZKTeco machine protocol strictly expects plain text "OK"
    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error: any) {
    console.error("Biometric webhook error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process biometric webhook" },
      { status: 500 }
    );
  }
}
