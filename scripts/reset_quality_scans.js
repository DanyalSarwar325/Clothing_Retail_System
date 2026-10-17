const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.xbsiszdcutfenbqretfl:ZqFq7gDb4MaLFw2F@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new Pool({
  connectionString,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetQualityScans() {
  console.log("Checking existing Quality records in database...");

  // 1. Count quality scans
  const qualityScansCount = await prisma.barcodeScan.count({
    where: { department: "Quality" },
  });
  console.log(`Quality scans count in BarcodeScan: ${qualityScansCount}`);

  // 2. Count QualityCheckLog
  const qualityLogsCount = await prisma.qualityCheckLog.count();
  console.log(`QualityCheckLog entries count: ${qualityLogsCount}`);

  // 3. Count BarcodeDefect
  const defectsCount = await prisma.barcodeDefect.count();
  console.log(`BarcodeDefect entries count: ${defectsCount}`);

  // 4. Count AdminDefectReview
  const defectReviewsCount = await prisma.adminDefectReview.count();
  console.log(`AdminDefectReview entries count: ${defectReviewsCount}`);

  // 5. Count Quality payments
  const qualityPaymentsCount = await prisma.barcodePayment.count({
    where: { department: "Quality" },
  });
  console.log(`Quality BarcodePayment entries count: ${qualityPaymentsCount}`);

  // 6. Barcodes with status quality_ok, defective, damaged or currentDepartment Quality
  const affectedBarcodes = await prisma.barcode.findMany({
    where: {
      OR: [
        { currentDepartment: "Quality" },
        { status: { in: ["quality_ok", "defective", "damaged"] } },
        { departmentHistory: { some: { department: "Quality" } } },
      ],
    },
    include: {
      departmentHistory: {
        orderBy: { scannedAt: "asc" },
      },
    },
  });
  console.log(`Barcodes affected by Quality: ${affectedBarcodes.length}`);

  // Execute Deletions and Resets
  console.log("\nDeleting Quality records...");

  // Delete defect reviews first (foreign key to Barcode / AdminDefectReview)
  await prisma.defectDepartmentReview.deleteMany();
  await prisma.adminDefectReview.deleteMany();

  // Delete defects
  const delDefects = await prisma.barcodeDefect.deleteMany();
  console.log(`Deleted ${delDefects.count} BarcodeDefect records.`);

  // Delete quality check logs
  const delLogs = await prisma.qualityCheckLog.deleteMany();
  console.log(`Deleted ${delLogs.count} QualityCheckLog records.`);

  // Delete quality scan events from BarcodeScan
  const delScans = await prisma.barcodeScan.deleteMany({
    where: { department: "Quality" },
  });
  console.log(`Deleted ${delScans.count} Quality BarcodeScan records.`);

  // Also delete auto-generated Overlock and Clipping scans created during quality checks if needed
  const delOverlock = await prisma.barcodeScan.deleteMany({
    where: {
      department: "Overlock",
      scannedBy: "Overlock",
    },
  });
  console.log(`Deleted ${delOverlock.count} auto-generated Overlock scans.`);

  const delClipping = await prisma.barcodeScan.deleteMany({
    where: {
      department: "Clipping",
      scannedBy: "Clipping",
    },
  });
  console.log(`Deleted ${delClipping.count} auto-generated Clipping scans.`);

  // Delete any Quality department payments
  const delPayments = await prisma.barcodePayment.deleteMany({
    where: { department: "Quality" },
  });
  console.log(`Deleted ${delPayments.count} Quality BarcodePayment records.`);

  // Reset barcodes status and currentDepartment back to their previous department (Sewing or Cutting)
  console.log("Resetting affected barcodes status and current department...");
  let resetCount = 0;
  for (const b of affectedBarcodes) {
    // Check remaining scan history without Quality/Overlock/Clipping
    const nonQualityHistory = b.departmentHistory.filter(
      (h) => !["Quality", "Overlock", "Clipping"].includes(h.department)
    );

    const hasSewing = nonQualityHistory.some((h) => h.department === "Sewing");
    const hasCutting = nonQualityHistory.some((h) => h.department === "Cutting");

    let newStatus = "generated";
    let newCurrentDept = "Cutting";

    if (hasSewing) {
      newStatus = "scanned";
      newCurrentDept = "Sewing";
    } else if (hasCutting) {
      newStatus = "generated";
      newCurrentDept = "Cutting";
    }

    await prisma.barcode.update({
      where: { id: b.id },
      data: {
        status: newStatus,
        currentDepartment: newCurrentDept,
      },
    });
    resetCount++;
  }

  console.log(`Successfully reset ${resetCount} barcodes back to pre-quality state.`);
  console.log("Quality database reset is complete!");
}

resetQualityScans()
  .catch((err) => {
    console.error("Error resetting quality records:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
