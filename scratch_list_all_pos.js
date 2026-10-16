const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.xbsiszdcutfenbqretfl:ZqFq7gDb4MaLFw2F@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      receivingLogs: { include: { items: true } },
      departmentRates: true,
      barcodes: true,
    }
  });

  console.log(`TOTAL POS IN DB: ${pos.length}`);
  for (const p of pos) {
    console.log(`PO: ${p.poNumber} | ID: ${p.id} | Design: ${p.design} | Status: ${p.status}`);
    console.log(`Planned:`, JSON.stringify(p.plannedQuantities));
    console.log(`Received:`, JSON.stringify(p.receivedQuantities));
    console.log(`Barcoded:`, JSON.stringify(p.barcodedQuantities));
    console.log(`Receiving logs: ${p.receivingLogs.length}`);
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
