const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.xbsiszdcutfenbqretfl:ZqFq7gDb4MaLFw2F@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
});

async function main() {
  await pool.query(`
    ALTER TABLE "DefectDepartmentReview" 
    ADD COLUMN IF NOT EXISTS "isSettled" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "settledVoucherId" TEXT,
    ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
  `);
  console.log('Successfully added settlement columns to DefectDepartmentReview!');

  const res = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'DefectDepartmentReview'"
  );
  console.log('Updated Columns:', res.rows.map(r => r.column_name));
  await pool.end();
}

main().catch(console.error);
