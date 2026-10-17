import prisma from "@/app/libs/prisma";
import { getActiveFinancialYear } from "./postingService";
import { generateSequenceNumber } from "./voucherNumberService";
import { ensureAccountingSeeded } from "./seedAccounting";

/**
 * Calculates the unit manufacturing cost of a suit based on:
 * 1. Raw materials cost per unit
 * 2. Piece-rate labor across departments (cutting, sewing, quality, press, packing)
 * Falls back to 50% of selling price or a baseline if unrecorded.
 */
export async function getSuitUnitCost(
  design: string,
  suitType: string,
  sellingPrice: number = 0
): Promise<number> {
  try {
    // 1. Raw Material cost per suit
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { design },
      include: { items: true },
    });

    let rawMaterialCostPerSuit = 0;
    if (rawMaterial && rawMaterial.totalCost > 0) {
      const totalSuits = await prisma.finalSticker.count({ where: { design } });
      if (totalSuits > 0) {
        rawMaterialCostPerSuit = Math.round((rawMaterial.totalCost / totalSuits) * 100) / 100;
      } else {
        rawMaterialCostPerSuit = rawMaterial.totalCost;
      }
    }

    // 2. Piece-rate labor costs
    let laborCost = 0;
    const po = await prisma.purchaseOrder.findFirst({
      where: { design },
      include: { departmentRates: true },
      orderBy: { createdAt: "desc" },
    });

    if (po && po.departmentRates.length > 0) {
      laborCost = po.departmentRates.reduce((sum, r) => sum + (r.ratePerPiece || 0), 0);
    } else {
      const sampleBarcode = await prisma.barcode.findFirst({
        where: { design },
        include: { departmentRates: true },
      });
      if (sampleBarcode && sampleBarcode.departmentRates.length > 0) {
        laborCost = sampleBarcode.departmentRates.reduce((sum, r) => sum + (r.ratePerPiece || 0), 0);
      }
    }

    const sampleSticker = await prisma.finalSticker.findFirst({
      where: { design },
      include: { departmentRates: true },
    });
    if (sampleSticker && sampleSticker.departmentRates.length > 0) {
      laborCost += sampleSticker.departmentRates.reduce((sum, r) => sum + (r.ratePerPiece || 0), 0);
    }

    const calculatedCost = rawMaterialCostPerSuit + laborCost;
    if (calculatedCost > 0) {
      return Math.round(calculatedCost);
    }

    if (sellingPrice > 0) {
      return Math.round(sellingPrice * 0.5);
    }

    return 1500;
  } catch (error) {
    console.error("Error calculating suit unit cost:", error);
    return sellingPrice > 0 ? Math.round(sellingPrice * 0.5) : 1500;
  }
}

async function getSystemUserId(): Promise<string> {
  const adminUser =
    (await prisma.user.findFirst({ where: { role: "admin" } })) ||
    (await prisma.user.findFirst());
  return adminUser ? adminUser.id : "system";
}

/**
 * Automatically posts a Journal Voucher when a suit is checked into the store:
 * Debit: AS-102 Finished Goods Inventory (Store Stock)
 * Credit: AS-105 Work-In-Progress Inventory (WIP)
 */
export async function postStoreCheckInJournal(params: {
  finalStickerId: string;
  design: string;
  suitType: string;
  size: string;
  unitNumber: number;
  sellingPrice?: number;
  scannedBy?: string;
}) {
  try {
    await ensureAccountingSeeded();
    const fy = await getActiveFinancialYear();
    const userId = await getSystemUserId();

    const finishedGoodsAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "finishedGoodsInventory", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "AS-102", status: "active" },
      }));

    const wipAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "wipInventory", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "AS-105", status: "active" },
      }));

    if (!finishedGoodsAccount || !wipAccount) {
      console.warn("Finished Goods or WIP account not configured in Chart of Accounts. Skipping journal.");
      return null;
    }

    const unitCost = await getSuitUnitCost(params.design, params.suitType, params.sellingPrice || 0);
    if (unitCost <= 0) return null;

    const voucherNumber = await generateSequenceNumber("JV", new Date());

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          type: "JV",
          transactionDate: new Date(),
          financialYearId: fy.id,
          sourceType: "store_check_in",
          sourceId: params.finalStickerId,
          description: `Finished Goods In: Suit ${params.design} (${params.suitType}) Size ${params.size} Unit #${params.unitNumber}`,
          totalAmount: unitCost,
          status: "posted",
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          voucherId: voucher.id,
          financialYearId: fy.id,
          transactionDate: new Date(),
          description: `Suit ${params.design} (${params.suitType}) Size ${params.size} Unit #${params.unitNumber} transferred to Store Stock`,
          totalDebit: unitCost,
          totalCredit: unitCost,
          status: "posted",
          lines: {
            create: [
              {
                accountId: finishedGoodsAccount.id,
                debit: unitCost,
                credit: 0,
                description: `Finished Goods Stock In - Unit #${params.unitNumber}`,
              },
              {
                accountId: wipAccount.id,
                debit: 0,
                credit: unitCost,
                description: `Relieved from Work-in-Progress (WIP)`,
              },
            ],
          },
        },
      });

      return { voucher, journalEntry };
    });

    return result;
  } catch (error) {
    console.error("Failed to post store check-in journal:", error);
    return null;
  }
}

/**
 * Automatically posts Sales & COGS Journal Voucher when a suit is sold/checked out:
 * 1. Sales Recognition:
 *    Debit: Cash in Hand (AS-103) or Customer Accounts Receivable (AS-106)
 *    Credit: Sales Revenue (RE-104 or RE-101)
 * 2. Inventory Reduction:
 *    Debit: Cost of Goods Sold (DE-101)
 *    Credit: Finished Goods Inventory (AS-102)
 */
export async function postStoreCheckOutJournal(params: {
  finalStickerId: string;
  design: string;
  suitType: string;
  size: string;
  unitNumber: number;
  sellingPrice: number;
  checkoutType?: string;
  customerName?: string;
  dispatchedBy?: string;
}) {
  try {
    await ensureAccountingSeeded();
    const fy = await getActiveFinancialYear();
    const userId = await getSystemUserId();

    const isWholesale = params.checkoutType === "WholeSale";

    // 1. Debit Account (Receivable for wholesale or customer name, Cash for retail counter)
    let debitAccount = null;
    if (isWholesale || params.customerName) {
      debitAccount =
        (await prisma.account.findFirst({
          where: { accountRole: "accountsReceivable", status: "active" },
        })) ||
        (await prisma.account.findFirst({
          where: { code: "AS-106", status: "active" },
        }));
    } else {
      debitAccount =
        (await prisma.account.findFirst({
          where: { accountRole: "cash", status: "active" },
        })) ||
        (await prisma.account.findFirst({
          where: { code: "AS-103", status: "active" },
        }));
    }

    // 2. Sales Revenue Account
    const revenueAccount =
      (await prisma.account.findFirst({
        where: {
          accountRole: "salesRevenue",
          status: "active",
          ...(isWholesale ? { code: "RE-101" } : { code: "RE-104" }),
        },
      })) ||
      (await prisma.account.findFirst({
        where: { accountRole: "salesRevenue", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { rootType: "revenue", status: "active" },
      }));

    // 3. Finished Goods Account & COGS Account
    const finishedGoodsAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "finishedGoodsInventory", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "AS-102", status: "active" },
      }));

    const cogsAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "costOfGoodsSold", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "DE-101", status: "active" },
      }));

    if (!debitAccount || !revenueAccount) {
      console.warn("Cash/Receivable or Revenue account not configured in Chart of Accounts. Skipping sales journal.");
      return null;
    }

    const saleAmount = params.sellingPrice || 0;
    const unitCost = await getSuitUnitCost(params.design, params.suitType, saleAmount);

    const voucherType = isWholesale ? "JV" : "CRV";
    const voucherNumber = await generateSequenceNumber(voucherType, new Date());

    const totalDebit = saleAmount + (cogsAccount && finishedGoodsAccount && unitCost > 0 ? unitCost : 0);
    const totalCredit = totalDebit;

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          type: voucherType,
          transactionDate: new Date(),
          financialYearId: fy.id,
          sourceType: "store_check_out",
          sourceId: params.finalStickerId,
          description: `Store Sale (${params.checkoutType || "Retail"}): ${params.design} (${params.suitType}) Size ${params.size} Unit #${params.unitNumber}${params.customerName ? " - " + params.customerName : ""}`,
          totalAmount: saleAmount,
          paymentMode: isWholesale ? "online" : "cash",
          status: "posted",
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      const journalLines: any[] = [
        {
          accountId: debitAccount.id,
          debit: saleAmount,
          credit: 0,
          description: `Sale Receipt (${params.checkoutType || "Retail"}) - Unit #${params.unitNumber}`,
        },
        {
          accountId: revenueAccount.id,
          debit: 0,
          credit: saleAmount,
          description: `Revenue: ${params.design} (${params.suitType}) Size ${params.size}`,
        },
      ];

      // Add COGS & Inventory Reduction lines
      if (cogsAccount && finishedGoodsAccount && unitCost > 0) {
        journalLines.push({
          accountId: cogsAccount.id,
          debit: unitCost,
          credit: 0,
          description: `COGS: Cost of suit sold - Unit #${params.unitNumber}`,
        });
        journalLines.push({
          accountId: finishedGoodsAccount.id,
          debit: 0,
          credit: unitCost,
          description: `Finished Goods Inventory reduction - Unit #${params.unitNumber}`,
        });
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          voucherId: voucher.id,
          financialYearId: fy.id,
          transactionDate: new Date(),
          description: `Sale & Inventory relief: Suit ${params.design} Unit #${params.unitNumber}`,
          totalDebit,
          totalCredit,
          status: "posted",
          lines: {
            create: journalLines,
          },
        },
      });

      return { voucher, journalEntry };
    });

    return result;
  } catch (error) {
    console.error("Failed to post store check-out journal:", error);
    return null;
  }
}

/**
 * Automatically posts a Return Journal Voucher when a suit is returned to the store:
 * 1. Reverses the Sales Revenue & Cash/Receivable
 * 2. Restocks Finished Goods Inventory and reverses COGS
 */
export async function postStoreReturnJournal(params: {
  finalStickerId: string;
  design: string;
  suitType: string;
  size: string;
  unitNumber: number;
  sellingPrice: number;
  returnedBy?: string;
  remarks?: string;
}) {
  try {
    await ensureAccountingSeeded();
    const fy = await getActiveFinancialYear();
    const userId = await getSystemUserId();

    // 1. Sales Return Account (RE-102) or Revenue Account (RE-104)
    const returnAccount =
      (await prisma.account.findFirst({
        where: { code: "RE-102", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { accountRole: "salesRevenue", status: "active" },
      }));

    // 2. Cash or Receivable Account
    const cashOrReceivable =
      (await prisma.account.findFirst({
        where: { accountRole: "cash", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "AS-103", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { accountRole: "accountsReceivable", status: "active" },
      }));

    // 3. Finished Goods & COGS
    const finishedGoodsAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "finishedGoodsInventory", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "AS-102", status: "active" },
      }));

    const cogsAccount =
      (await prisma.account.findFirst({
        where: { accountRole: "costOfGoodsSold", status: "active" },
      })) ||
      (await prisma.account.findFirst({
        where: { code: "DE-101", status: "active" },
      }));

    if (!returnAccount || !cashOrReceivable) {
      console.warn("Return or Cash account missing. Skipping return journal.");
      return null;
    }

    const saleAmount = params.sellingPrice || 0;
    const unitCost = await getSuitUnitCost(params.design, params.suitType, saleAmount);

    const voucherNumber = await generateSequenceNumber("JV", new Date());
    const totalDebit = saleAmount + (cogsAccount && finishedGoodsAccount && unitCost > 0 ? unitCost : 0);
    const totalCredit = totalDebit;

    const result = await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          type: "JV",
          transactionDate: new Date(),
          financialYearId: fy.id,
          sourceType: "store_return",
          sourceId: params.finalStickerId,
          description: `Store Return: Suit ${params.design} (${params.suitType}) Size ${params.size} Unit #${params.unitNumber}. Notes: ${params.remarks || ""}`,
          totalAmount: saleAmount,
          status: "posted",
          createdById: userId,
          postedById: userId,
          postedAt: new Date(),
        },
      });

      const journalLines: any[] = [
        {
          accountId: returnAccount.id,
          debit: saleAmount,
          credit: 0,
          description: `Sales Return: Unit #${params.unitNumber}`,
        },
        {
          accountId: cashOrReceivable.id,
          debit: 0,
          credit: saleAmount,
          description: `Refund / Receivable reversed for Unit #${params.unitNumber}`,
        },
      ];

      if (cogsAccount && finishedGoodsAccount && unitCost > 0) {
        journalLines.push({
          accountId: finishedGoodsAccount.id,
          debit: unitCost,
          credit: 0,
          description: `Restocked to Finished Goods Inventory - Unit #${params.unitNumber}`,
        });
        journalLines.push({
          accountId: cogsAccount.id,
          debit: 0,
          credit: unitCost,
          description: `Reversal of COGS for returned suit - Unit #${params.unitNumber}`,
        });
      }

      const journalEntry = await tx.journalEntry.create({
        data: {
          voucherId: voucher.id,
          financialYearId: fy.id,
          transactionDate: new Date(),
          description: `Store return and inventory restock: Suit ${params.design} Unit #${params.unitNumber}`,
          totalDebit,
          totalCredit,
          status: "posted",
          lines: {
            create: journalLines,
          },
        },
      });

      return { voucher, journalEntry };
    });

    return result;
  } catch (error) {
    console.error("Failed to post store return journal:", error);
    return null;
  }
}
