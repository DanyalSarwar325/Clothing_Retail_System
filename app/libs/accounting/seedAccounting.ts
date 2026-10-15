import prisma from "@/app/libs/prisma";

let isSeededCache = false;

export async function ensureAccountingSeeded() {
  if (isSeededCache) {
    return { cached: true };
  }

  const existingFY = await prisma.financialYear.findFirst({
    where: { isCurrent: true },
  });

  if (existingFY) {
    isSeededCache = true;
    return { activeFY: existingFY };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const isAfterJune = now.getMonth() >= 6; // July is index 6
  const fyStartYear = isAfterJune ? currentYear : currentYear - 1;
  const fyEndYear = fyStartYear + 1;
  const fyName = `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`;

  let activeFY = await prisma.financialYear.findUnique({
    where: { name: fyName },
  });

  if (!activeFY) {
    await prisma.financialYear.updateMany({
      where: {},
      data: { isCurrent: false },
    });

    activeFY = await prisma.financialYear.create({
      data: {
        name: fyName,
        startDate: new Date(fyStartYear, 6, 1), // 1 July
        endDate: new Date(fyEndYear, 5, 30, 23, 59, 59), // 30 June
        status: "open",
        isCurrent: true,
      },
    });
  }

  isSeededCache = true;
  return { activeFY };
}
