import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { lineTotalMinor, sumMinor } from "@/lib/money";

/**
 * ROHI canonical billing service.
 *
 * The bill is the single shared core that POS, manual, and native billing
 * all feed into. Totals (subtotal / adjustmentTotal / total) are stored on
 * the Bill row as a denormalized cache, but the AUTHORITATIVE computation is
 * always from BillItem + BillAdjustment rows, recomputed inside a
 * transaction on every mutation. Money is integer minor units throughout.
 */

export interface BillTotals {
  subtotalMinor: number;
  adjustmentTotalMinor: number;
  totalMinor: number;
}

export class BillingError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "BillingError";
  }
}

/**
 * Recompute a bill's totals from its items + adjustments and persist them.
 * MUST run inside a transaction (tx) so the read + write are atomic — no
 * mutation to items/adjustments should happen outside the same transaction.
 */
export async function recomputeBillTotals(
  billId: string,
  tx: Prisma.TransactionClient,
): Promise<BillTotals> {
  const [items, adjustments] = await Promise.all([
    tx.billItem.findMany({ where: { billId }, select: { totalMinor: true } }),
    tx.billAdjustment.findMany({
      where: { billId },
      select: { amountMinor: true },
    }),
  ]);

  const subtotalMinor = sumMinor(items.map((i) => i.totalMinor));
  const adjustmentTotalMinor = sumMinor(adjustments.map((a) => a.amountMinor));
  const totalMinor = subtotalMinor + adjustmentTotalMinor;

  await tx.bill.update({
    where: { id: billId },
    data: { subtotalMinor, adjustmentTotalMinor, totalMinor },
  });

  return { subtotalMinor, adjustmentTotalMinor, totalMinor };
}

/**
 * Get the active (OPEN) bill for a table, with items + adjustments.
 * Returns null if the table has no open bill.
 */
export async function getActiveBillForTable(tableId: string) {
  return db.bill.findFirst({
    where: { tableId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      adjustments: { orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Open a new bill on a table. Refuses if the table already has an OPEN bill
 * (one active bill per table at a time). Currency is read from the restaurant.
 */
export async function openBillOnTable(params: {
  tableId: string;
  restaurantId: string;
  source: "POS" | "MANUAL" | "NATIVE";
  externalPosBillId?: string;
}) {
  const existing = await db.bill.findFirst({
    where: { tableId: params.tableId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) {
    throw new BillingError("table_already_has_open_bill");
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { currency: true },
  });
  if (!restaurant) {
    throw new BillingError("restaurant_not_found");
  }

  return db.bill.create({
    data: {
      restaurantId: params.restaurantId,
      tableId: params.tableId,
      source: params.source,
      status: "OPEN",
      currency: restaurant.currency,
      subtotalMinor: 0,
      adjustmentTotalMinor: 0,
      totalMinor: 0,
      externalPosBillId: params.externalPosBillId,
    },
  });
}

/**
 * Verify a bill belongs to the caller's restaurant and is OPEN (mutable).
 * Throws BillingError otherwise. Returns the bill with currency for parsing.
 */
export async function getOwnedOpenBill(
  billId: string,
  restaurantId: string,
) {
  const bill = await db.bill.findFirst({
    where: { id: billId, restaurantId },
    select: { id: true, status: true, tableId: true, currency: true },
  });
  if (!bill) throw new BillingError("bill_not_found");
  if (bill.status !== "OPEN") throw new BillingError("bill_not_open");
  return bill;
}

export type BillWithDetails = Prisma.BillGetPayload<{
  include: {
    items: { orderBy: { createdAt: "asc" } };
    adjustments: { orderBy: { createdAt: "asc" } };
  };
}>;

/** Line-item total helper exposed for API routes. */
export function computeItemTotal(
  quantity: number,
  unitPriceMinor: number,
): number {
  return lineTotalMinor(quantity, unitPriceMinor);
}
