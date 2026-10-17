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

const accountsToEnsure = [
  // ==========================================
  // 1. ASSETS
  // ==========================================
  {
    code: "AS-101",
    title: "Bank Account",
    rootType: "asset",
    accountRole: "bank",
    description: "Main business bank account for deposits and payments",
  },
  {
    code: "AS-102",
    title: "Finished Goods Inventory (Store Stock)",
    rootType: "asset",
    accountRole: "finishedGoodsInventory",
    description: "Ready suits in the Store available for sale",
  },
  {
    code: "AS-103",
    title: "Cash in Hand (Counter / Cash Drawer)",
    rootType: "asset",
    accountRole: "cash",
    description: "Cash received from retail counter sales and daily petty cash",
  },
  {
    code: "AS-104",
    title: "Raw Material Inventory (Fabric & Accessories)",
    rootType: "asset",
    accountRole: "rawMaterialInventory",
    description: "Uncut fabrics, rolls, laces, threads, and accessories in stock",
  },
  {
    code: "AS-105",
    title: "Work-In-Progress Inventory (WIP)",
    rootType: "asset",
    accountRole: "wipInventory",
    description: "Suits currently in production (cutting, sewing, embroidery, press)",
  },
  {
    code: "AS-106",
    title: "Customer Accounts Receivable",
    rootType: "asset",
    accountRole: "accountsReceivable",
    description: "Outstanding balances from wholesale customers and pending COD payments",
  },
  {
    code: "AS-107",
    title: "Worker & Contractor Advances",
    rootType: "asset",
    accountRole: "workerAdvance",
    description: "Advance cash paid to workers/contractors to be deducted from piece wages",
  },

  // ==========================================
  // 2. LIABILITIES
  // ==========================================
  {
    code: "LI-101",
    title: "Accounts Payable (Suppliers)",
    rootType: "liability",
    accountRole: "accountsPayable",
    description: "Unpaid bills owed to fabric mills and accessory suppliers",
  },
  {
    code: "LI-102",
    title: "Wages & Piece-Rates Payable (Workers)",
    rootType: "liability",
    accountRole: "wagesPayable",
    description: "Accrued piece-rate earnings owed to cutters, stitchers, pressers, packers",
  },
  {
    code: "LI-103",
    title: "Customer Advance Deposits",
    rootType: "liability",
    accountRole: "general",
    description: "Advances received from customers for pending or custom orders",
  },

  // ==========================================
  // 3. EQUITY
  // ==========================================
  {
    code: "EQ-101",
    title: "Owner's Capital",
    rootType: "equity",
    accountRole: "ownerCapital",
    description: "Total capital invested by the owner into the business",
  },
  {
    code: "EQ-102",
    title: "Owner's Drawings",
    rootType: "equity",
    accountRole: "general",
    description: "Personal funds or cash drawings taken by the owner",
  },
  {
    code: "EQ-103",
    title: "Retained Earnings / Accumulated Profit",
    rootType: "equity",
    accountRole: "general",
    description: "Accumulated net profits carried forward from previous accounting years",
  },

  // ==========================================
  // 4. REVENUE
  // ==========================================
  {
    code: "RE-104",
    title: "Sales Revenue (Retail Counter)",
    rootType: "revenue",
    accountRole: "salesRevenue",
    description: "Income earned from selling suits directly to retail customers",
  },
  {
    code: "RE-101",
    title: "Sales Revenue (Wholesale & Bulk)",
    rootType: "revenue",
    accountRole: "salesRevenue",
    description: "Income from bulk suit orders to shopkeepers and commercial clients",
  },
  {
    code: "RE-102",
    title: "Sales Returns & Customer Discounts",
    rootType: "revenue",
    accountRole: "general",
    description: "Contra-revenue account for returned suits and price discounts given",
  },

  // ==========================================
  // 5. DIRECT EXPENSES / COST OF PRODUCTION
  // ==========================================
  {
    code: "DE-101",
    title: "Cost of Goods Sold (COGS - Finished Suits)",
    rootType: "directExpense",
    accountRole: "costOfGoodsSold",
    description: "Direct manufacturing cost of suits recognized when suits are sold",
  },
  {
    code: "DE-102",
    title: "Electricity Cost (Factory & Shop)",
    rootType: "directExpense",
    accountRole: "general",
    description: "Power consumption for factory machinery and shop lighting",
  },
  {
    code: "DE-103",
    title: "Fabric & Raw Material Consumed",
    rootType: "directExpense",
    accountRole: "general",
    description: "Cost of cloth and fabric issued into production for cutting",
  },
  {
    code: "DE-104",
    title: "Direct Worker Piece-Rate Wages",
    rootType: "directExpense",
    accountRole: "general",
    description: "Direct wages paid per piece for cutting, sewing, quality, press, and packing",
  },
  {
    code: "DE-105",
    title: "Embroidery, Lace & Adda Work Expenses",
    rootType: "directExpense",
    accountRole: "general",
    description: "Direct costs for suit embellishments, patches, and hand-work",
  },
  {
    code: "DE-106",
    title: "Packaging, Polybag & Sticker Supplies",
    rootType: "directExpense",
    accountRole: "general",
    description: "Suit polybags, cartons, brand labels, and barcode sticker paper",
  },

  // ==========================================
  // 6. INDIRECT EXPENSES (OVERHEADS)
  // ==========================================
  {
    code: "IE-101",
    title: "Cutting Cost",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Cutting master department operational overheads",
  },
  {
    code: "IE-102",
    title: "Shop & Factory Rent",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Monthly rental for store premises and production workshop",
  },
  {
    code: "IE-103",
    title: "Salaries & Admin Staff Wages",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Fixed monthly salaries for supervisors, store incharge, and accounts",
  },
  {
    code: "IE-104",
    title: "Courier, Shipping & Delivery Charges",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Courier fees for shipping suits to online/wholesale customers",
  },
  {
    code: "IE-105",
    title: "Repairs & Sewing Machine Maintenance",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Servicing and spare parts for stitching machines, cutters, and steam irons",
  },
  {
    code: "IE-106",
    title: "Tea, Refreshment & Office Expenses",
    rootType: "indirectExpense",
    accountRole: "general",
    description: "Staff tea, drinking water, stationery, and daily minor expenses",
  },
];

async function main() {
  console.log("Checking and expanding Chart of Accounts...");

  for (const acc of accountsToEnsure) {
    const existing = await prisma.account.findUnique({
      where: { code: acc.code },
    });

    if (existing) {
      // Update existing account to ensure proper role and clear title
      await prisma.account.update({
        where: { code: acc.code },
        data: {
          title: acc.title,
          rootType: acc.rootType,
          accountRole: acc.accountRole,
          description: acc.description,
          status: "active",
        },
      });
      console.log(`Updated existing account: ${acc.code} | ${acc.title} (${acc.accountRole})`);
    } else {
      // Create new account
      await prisma.account.create({
        data: {
          code: acc.code,
          title: acc.title,
          rootType: acc.rootType,
          accountRole: acc.accountRole,
          description: acc.description,
          isSystem: true,
          status: "active",
        },
      });
      console.log(`Created new account: ${acc.code} | ${acc.title} (${acc.accountRole})`);
    }
  }

  const allAccounts = await prisma.account.findMany({
    orderBy: [{ rootType: "asc" }, { code: "asc" }],
  });
  console.log(`\nSuccessfully finalized Chart of Accounts! Total accounts: ${allAccounts.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
