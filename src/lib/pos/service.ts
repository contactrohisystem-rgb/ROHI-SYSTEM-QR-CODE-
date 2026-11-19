import { db } from "@/lib/db";
import { PosAdapterCode, PosSyncDirection, PosSyncStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { getAdapter } from "./registry";
import { recomputeBillTotals } from "@/lib/billing";
import { setMockPosFailure, getMockPosFailure } from "./adapters/mock";
import { PosError } from "./adapter";

export { setMockPosFailure, getMockPosFailure };
export { PosError };

/**
 * POS synchronization service.
 *
 * Two directions, both durable + retryable via PosSyncRecord:
 *   BILL_FETCH       — a bill arrives from the POS (handled inline at fetch).
 *   PAYMENT_CONFIRM  — a paid bill's confirmation is sent back to the POS.
 *
 * Payment status and POS sync status are INDEPENDENT: a payment can be
 * SUCCEEDED while its confirm-sync is RETRYING/FAILED. A successful payment
 * stays successful even if the POS is temporarily unavailable.
 */

const MAX_ATTEMPTS = 5;

/** Exponential backoff: 5s, 15s, 45s, 135s, 300s (capped). */
function backoffMs(attempts: number): number {
  const seconds = Math.min(300, 5 * Math.pow(3, attempts - 1));
  return seconds * 1000;
}

// ─── Connection ─────────────────────────────────────────────────────────────

export async function configurePosConnection(params: {
  restaurantId: string;
  adapterCode: PosAdapterCode;
}): Promise<void> {
  const adapter = getAdapter(params.adapterCode);
  if (!adapter) throw new PosError("adapter_unavailable");
  await db.posConnection.upsert({
    where: { restaurantId: params.restaurantId },
    update: { adapterCode: params.adapterCode, status: "ACTIVE", lastError: null },
    create: {
      restaurantId: params.restaurantId,
      adapterCode: params.adapterCode,
      status: "ACTIVE",
    },
  });
}

export async function getPosConnection(restaurantId: string) {
  return db.posConnection.findUnique({ where: { restaurantId } });
}

// ─── Sync records ───────────────────────────────────────────────────────────

export async function getSyncRecords(restaurantId: string, limit = 20) {
  return db.posSyncRecord.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      bill: { select: { id: true, externalPosBillId: true } },
    },
  });
}

// ─── Enqueue (on payment success) ───────────────────────────────────────────

/**
 * Enqueue a PAYMENT_CONFIRM sync for a paid bill, then best-effort process it.
 *
 * Only POS-sourced bills (source=POS, externalPosBillId set) have a POS bill
 * to confirm to. NATIVE/MANUAL bills have no POS counterpart — no sync.
 * Idempotent: if a non-terminal sync already exists for this bill, skip.
 */
export async function enqueuePaymentConfirmation(
  billId: string,
): Promise<void> {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      restaurantId: true,
      source: true,
      externalPosBillId: true,
    },
  });
  if (!bill) return;
  if (bill.source !== "POS" || !bill.externalPosBillId) return;

  const connection = await db.posConnection.findUnique({
    where: { restaurantId: bill.restaurantId },
  });
  if (!connection || connection.adapterCode === "NONE") return;

  const existing = await db.posSyncRecord.findFirst({
    where: {
      billId: bill.id,
      direction: "PAYMENT_CONFIRM",
      status: { in: ["PENDING", "RETRYING", "SUCCEEDED"] },
    },
    select: { id: true },
  });
  if (existing) return;

  const record = await db.posSyncRecord.create({
    data: {
      restaurantId: bill.restaurantId,
      billId: bill.id,
      adapterCode: connection.adapterCode,
      direction: "PAYMENT_CONFIRM",
      status: "PENDING",
      externalResourceId: bill.externalPosBillId,
    },
  });
  // Best-effort immediate processing. If it fails, the record stays RETRYING
  // and will be picked up by processDueSyncRecords (manual/cron trigger until
  // the background worker lands in Task 7).
  await processSyncRecord(record.id).catch(() => {
    // processSyncRecord already persisted the failure state.
  });
}

// ─── Processing (retry/backoff) ─────────────────────────────────────────────

/**
 * Attempt one sync. On success -> SUCCEEDED. On failure -> RETRYING (with
 * backoff) or FAILED (terminal after maxAttempts). Updates PosConnection
 * status + lastError + lastSyncAt accordingly.
 */
export async function processSyncRecord(recordId: string): Promise<void> {
  const record = await db.posSyncRecord.findUnique({
    where: { id: recordId },
    include: {
      bill: {
        select: {
          id: true,
          restaurantId: true,
          externalPosBillId: true,
          totalMinor: true,
          currency: true,
        },
      },
    },
  });
  if (!record) return;
  if (record.status === "SUCCEEDED" || record.status === "FAILED") return;

  const connection = await db.posConnection.findUnique({
    where: { restaurantId: record.restaurantId },
  });
  if (!connection || connection.adapterCode === "NONE") {
    await db.posSyncRecord.update({
      where: { id: recordId },
      data: {
        status: "FAILED",
        lastError: "no_pos_connection",
        lastAttemptAt: new Date(),
      },
    });
    return;
  }

  const adapter = getAdapter(connection.adapterCode);
  if (!adapter) {
    await db.posSyncRecord.update({
      where: { id: recordId },
      data: {
        status: "FAILED",
        lastError: "adapter_not_registered",
        lastAttemptAt: new Date(),
      },
    });
    return;
  }

  const newAttempts = record.attempts + 1;
  const now = new Date();

  try {
    if (record.direction === "PAYMENT_CONFIRM") {
      // For PAYMENT_CONFIRM, find the successful payment for this bill.
      const payment = await db.payment.findFirst({
        where: { billId: record.billId, status: "SUCCEEDED" },
        select: { id: true, amountMinor: true, currency: true, confirmedAt: true },
      });
      if (!payment) throw new Error("no_succeeded_payment");
      if (!record.bill.externalPosBillId) throw new Error("no_external_bill_id");
      await adapter.confirmPayment({
        restaurantId: record.restaurantId,
        externalPosBillId: record.bill.externalPosBillId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        paidAt: payment.confirmedAt ?? now,
      });
    } else {
      // BILL_FETCH is handled inline at fetch time; a sync record for it is
      // already SUCCEEDED when created. Nothing to do here.
      throw new Error("unsupported_direction");
    }

    // Success.
    await db.posSyncRecord.update({
      where: { id: recordId },
      data: {
        status: "SUCCEEDED",
        attempts: newAttempts,
        lastAttemptAt: now,
        nextAttemptAt: null,
        lastError: null,
      },
    });
    await db.posConnection.update({
      where: { restaurantId: record.restaurantId },
      data: { lastSyncAt: now, lastError: null, status: "ACTIVE" },
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "sync_failed";
    const isTerminal = newAttempts >= MAX_ATTEMPTS;
    await db.posSyncRecord.update({
      where: { id: recordId },
      data: {
        attempts: newAttempts,
        lastAttemptAt: now,
        lastError: errorMsg,
        status: isTerminal ? "FAILED" : "RETRYING",
        nextAttemptAt: isTerminal ? null : new Date(now.getTime() + backoffMs(newAttempts)),
      },
    });
    await db.posConnection.update({
      where: { restaurantId: record.restaurantId },
      data: { lastError: errorMsg, status: "ERROR" },
    });
  }
}

/**
 * Process all due sync records (PENDING or RETRYING with nextAttemptAt <= now).
 * Returns how many were attempted. This is the retry-loop entry point — in
 * production a cron/worker calls it every minute (Task 7). For now it is
 * triggered best-effort on enqueue and via a dashboard button.
 */
export async function processDueSyncRecords(): Promise<{ attempted: number }> {
  const due = await db.posSyncRecord.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    select: { id: true },
    take: 50,
  });
  for (const r of due) {
    await processSyncRecord(r.id).catch(() => {});
  }
  return { attempted: due.length };
}

// ─── Mock POS bill fetch (BILL_FETCH direction demo) ────────────────────────

/**
 * Simulate the POS sending a bill for a table. Uses the MockPosAdapter to
 * fetch a canned bill, creates a POS-sourced Bill with items + adjustments,
 * recomputes totals, and records a SUCCEEDED BILL_FETCH sync record.
 */
export async function fetchBillFromMockPos(params: {
  tableId: string;
  restaurantId: string;
}) {
  const adapter = getAdapter("MOCK");
  if (!adapter) throw new PosError("adapter_unavailable");

  const existing = await db.bill.findFirst({
    where: { tableId: params.tableId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) throw new PosError("table_has_open_bill");

  const restaurant = await db.restaurant.findUnique({
    where: { id: params.restaurantId },
    select: { currency: true },
  });
  if (!restaurant) throw new PosError("restaurant_not_found");

  const externalPosBillId = `pos_${randomBytes(4).toString("hex")}`;
  const posBill = await adapter.fetchBill({
    restaurantId: params.restaurantId,
    externalPosBillId,
  });

  const bill = await db.$transaction(async (tx) => {
    const created = await tx.bill.create({
      data: {
        restaurantId: params.restaurantId,
        tableId: params.tableId,
        source: "POS",
        status: "OPEN",
        currency: restaurant.currency,
        externalPosBillId: posBill.externalPosBillId,
        subtotalMinor: 0,
        adjustmentTotalMinor: 0,
        totalMinor: 0,
      },
    });
    for (const item of posBill.items) {
      const totalMinor = item.quantity * item.unitPriceMinor;
      await tx.billItem.create({
        data: {
          billId: created.id,
          name: item.name,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          totalMinor,
        },
      });
    }
    for (const adj of posBill.adjustments ?? []) {
      await tx.billAdjustment.create({
        data: {
          billId: created.id,
          type: adj.type,
          label: adj.label,
          amountMinor: adj.amountMinor,
        },
      });
    }
    await recomputeBillTotals(created.id, tx);
    return created;
  });

  // Record a SUCCEEDED BILL_FETCH sync entry (the fetch itself succeeded).
  await db.posSyncRecord.create({
    data: {
      restaurantId: params.restaurantId,
      billId: bill.id,
      adapterCode: "MOCK",
      direction: "BILL_FETCH",
      status: "SUCCEEDED",
      attempts: 1,
      lastAttemptAt: new Date(),
      externalResourceId: posBill.externalPosBillId,
    },
  });

  return bill;
}
