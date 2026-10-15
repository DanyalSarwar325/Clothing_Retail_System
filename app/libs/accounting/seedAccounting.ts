import prisma from "@/app/libs/prisma";

export async function ensureAccountingSeeded() {
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

  const defaultAccounts = [
    // --- ASSETS ---
    { code: "AS-101", title: "Cash in Hand", rootType: "asset", accountRole: "cash", isSystem: true, description: "Physical cash in factory drawer and counter" },
    { code: "AS-102", title: "Main Bank Account", rootType: "asset", accountRole: "bank", isSystem: true, description: "Primary business bank account" },
    { code: "AS-201", title: "Fabric Inventory", rootType: "asset", accountRole: "rawMaterialInventory", isSystem: true, description: "Raw fabric stock on floor" },
    { code: "AS-202", title: "Trims & Laces Inventory", rootType: "asset", accountRole: "rawMaterialInventory", isSystem: true, description: "Buttons, laces, threads inventory" },
    { code: "AS-203", title: "Work in Progress", rootType: "asset", accountRole: "wipInventory", isSystem: true, description: "Garments currently inside production stages" },
    { code: "AS-204", title: "Finished Goods Stock", rootType: "asset", accountRole: "finishedGoodsInventory", isSystem: true, description: "Packed suits in store warehouse" },
    { code: "AS-301", title: "Customer Receivables", rootType: "asset", accountRole: "accountsReceivable", isSystem: true, description: "Money customers need to pay" },
    { code: "AS-302", title: "Worker Advances", rootType: "asset", accountRole: "workerAdvance", isSystem: true, description: "Advance loans (peshgi) given to factory workers" },

    // --- LIABILITIES ---
    { code: "LI-101", title: "Supplier Payables", rootType: "liability", accountRole: "accountsPayable", isSystem: true, description: "Money we need to pay to fabric and material suppliers" },
    { code: "LI-102", title: "Contractor Payables", rootType: "liability", accountRole: "contractorPayable", isSystem: true, description: "Money we need to pay for dyeing, embroidery, etc." },
    { code: "LI-201", title: "Wages Payable", rootType: "liability", accountRole: "wagesPayable", isSystem: true, description: "Earned unpaid factory wages" },
    { code: "LI-301", title: "Accrued Factory Expenses", rootType: "liability", accountRole: "general", isSystem: true, description: "Unpaid factory bills like rent, electricity" },

    // --- DIRECT EXPENSES (Production Costs / COGS) ---
    { code: "DE-101", title: "Fabric Consumed", rootType: "directExpense", accountRole: "costOfGoodsSold", isSystem: true, description: "Cost of fabric used in manufactured suits" },
    { code: "DE-102", title: "Cutting Department Labor", rootType: "directExpense", accountRole: "general", isSystem: true, description: "Piece wages for cutting" },
    { code: "DE-103", title: "Sewing Department Labor", rootType: "directExpense", accountRole: "general", isSystem: true, description: "Piece wages for sewing machine workers" },
    { code: "DE-104", title: "Finishing & Press Labor", rootType: "directExpense", accountRole: "general", isSystem: true, description: "Piece wages for patching, press, packing" },
    { code: "DE-105", title: "Dyeing & Printing Charges", rootType: "directExpense", accountRole: "general", isSystem: true, description: "External processing for fabric dyeing and printing" },
    { code: "DE-106", title: "Adda Work & Hand Embroidery", rootType: "directExpense", accountRole: "general", isSystem: true, description: "Hand embroidery and specialized work" },
    { code: "DE-107", title: "Trims, Buttons & Laces", rootType: "directExpense", accountRole: "general", isSystem: true, description: "Direct trims used on designs" },

    // --- INDIRECT EXPENSES (Factory Overheads) ---
    { code: "IE-101", title: "Factory Rent", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Monthly building and floor rent" },
    { code: "IE-102", title: "Electricity & WAPDA", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Factory electrical bills" },
    { code: "IE-103", title: "Generator Fuel & Diesel", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Fuel for backup power during load shedding" },
    { code: "IE-104", title: "Machinery Maintenance & Needles", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Machine oil, spare parts, repairs" },
    { code: "IE-105", title: "Packing Tape & Cartons", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Boxes, tape, flyers for shipping" },
    { code: "IE-106", title: "Worker Refreshments & Tea", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Daily tea, water, factory refreshments" },
    { code: "IE-107", title: "Office Salaries & Admin", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Monthly fixed salaries for office/management staff" },
    { code: "IE-108", title: "Transport & Cargo Freight", rootType: "indirectExpense", accountRole: "general", isSystem: true, description: "Goods transport, cargo, rickshaw fare" },

    // --- REVENUE ---
    { code: "RE-101", title: "Garment Retail Sales", rootType: "revenue", accountRole: "salesRevenue", isSystem: true, description: "Retail and online suit sales revenue" },
    { code: "RE-102", title: "Wholesale Sales", rootType: "revenue", accountRole: "salesRevenue", isSystem: true, description: "Bulk order revenue" },
    { code: "RE-103", title: "Scrap & B-Pair Sales", rootType: "revenue", accountRole: "general", isSystem: true, description: "Proceeds from defective or leftover fabric/pieces" },

    // --- EQUITY ---
    { code: "EQ-101", title: "Owner Capital", rootType: "equity", accountRole: "ownerCapital", isSystem: true, description: "Owner's invested capital" },
    { code: "EQ-102", title: "Owner Drawings", rootType: "equity", accountRole: "general", isSystem: true, description: "Cash or funds withdrawn by owner" },
    { code: "EQ-103", title: "Retained Earnings", rootType: "equity", accountRole: "general", isSystem: true, description: "Cumulative net profit/loss carried forward" },
  ];

  for (const acc of defaultAccounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: acc,
    });
  }

  return { activeFY, seededAccountsCount: defaultAccounts.length };
}
