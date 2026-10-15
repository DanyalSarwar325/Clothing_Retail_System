import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.xbsiszdcutfenbqretfl:ZqFq7gDb4MaLFw2F@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export default prisma;
