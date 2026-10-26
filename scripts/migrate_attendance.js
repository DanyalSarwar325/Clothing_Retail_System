const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.xbsiszdcutfenbqretfl:ZqFq7gDb4MaLFw2F@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new Pool({ connectionString });

async function migrate() {
  console.log("Connecting to Supabase PostgreSQL to create Attendance & Salary tables...");

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SalariedEmployee" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "biometricPin" TEXT UNIQUE,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "department" TEXT NOT NULL DEFAULT 'General',
        "designation" TEXT NOT NULL,
        "salaryType" TEXT NOT NULL DEFAULT 'monthly',
        "baseSalary" DOUBLE PRECISION NOT NULL,
        "annualLeaveQuota" INTEGER NOT NULL DEFAULT 14,
        "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "SalariedEmployee_department_isActive_idx" 
        ON "SalariedEmployee"("department", "isActive");

      CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "employeeId" TEXT NOT NULL REFERENCES "SalariedEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "date" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "checkInTime" TIMESTAMP(3),
        "checkOutTime" TIMESTAMP(3),
        "workingHours" DOUBLE PRECISION,
        "source" TEXT NOT NULL DEFAULT 'MANUAL',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AttendanceRecord_employeeId_date_key" UNIQUE ("employeeId", "date")
      );

      CREATE INDEX IF NOT EXISTS "AttendanceRecord_date_status_idx" 
        ON "AttendanceRecord"("date", "status");

      CREATE TABLE IF NOT EXISTS "SalarySlip" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "employeeId" TEXT NOT NULL REFERENCES "SalariedEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "month" INTEGER NOT NULL,
        "year" INTEGER NOT NULL,
        "totalWorkingDays" INTEGER NOT NULL DEFAULT 26,
        "daysPresent" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "paidLeaves" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "unpaidLeaves" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "absentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "baseSalary" DOUBLE PRECISION NOT NULL,
        "dailyRate" DOUBLE PRECISION NOT NULL,
        "deductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "netSalary" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "paymentMethod" TEXT,
        "paymentVoucherId" TEXT,
        "paidAt" TIMESTAMP(3),
        "paidBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalarySlip_employeeId_month_year_key" UNIQUE ("employeeId", "month", "year")
      );

      CREATE INDEX IF NOT EXISTS "SalarySlip_month_year_status_idx" 
        ON "SalarySlip"("month", "year", "status");
    `);

    console.log("Attendance & Salary tables successfully created in Supabase!");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
