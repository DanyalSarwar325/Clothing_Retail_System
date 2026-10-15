import prisma from "@/app/libs/prisma";

export async function generateSequenceNumber(prefix: string, date: Date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const key = `${prefix}_${year}`;

  const counter = await prisma.counter.upsert({
    where: { key },
    update: { seq: { increment: 1 } },
    create: { key, seq: 1 },
  });

  const paddedSeq = String(counter.seq).padStart(4, "0");
  return `${prefix}-${year}-${paddedSeq}`;
}
