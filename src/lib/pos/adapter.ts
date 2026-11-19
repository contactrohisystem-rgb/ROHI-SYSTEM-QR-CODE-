import type { PosAdapterCode } from "@prisma/client";

/**
 * Provider-neutral POS adapter contract.
 *
 * A POS is only considered "fully integrated" when BOTH directions work:
 *   1. fetchBill      — receive/retrieve a bill FROM the POS (BILL_FETCH).
 *   2. confirmPayment — send a successful payment confirmation BACK to the
 *      POS (PAYMENT_CONFIRM).
 *
 * Adding a new POS system = implementing this interface + registering it.
 * The sync engine, the bill, and the payment flow never change.
 *
 * These operations are EXTERNAL calls and may fail transiently; the sync
 * service wraps them in PosSyncRecord with retry/backoff so a temporarily
 * unavailable POS never loses a confirmation (a successful payment STAYS
 * successful even if the POS is down).
 */
export interface PosBillItem {
  name: string;
  quantity: number;
  unitPriceMinor: number;
}
export interface PosBillAdjustment {
  type: string; // DISCOUNT | SURCHARGE | SERVICE | TAX
  label: string;
  amountMinor: number; // signed: negative for discounts
}
export interface PosBill {
  externalPosBillId: string;
  currency: string;
  items: PosBillItem[];
  adjustments?: PosBillAdjustment[];
  totalMinor: number; // informational; ROHI recomputes from items
}

export interface FetchBillParams {
  restaurantId: string;
  externalPosBillId: string;
}

export interface ConfirmPaymentParams {
  restaurantId: string;
  externalPosBillId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  paidAt: Date;
}

export interface PosAdapter {
  code: PosAdapterCode;
  /** Retrieve a bill from the POS (BILL_FETCH direction). */
  fetchBill(params: FetchBillParams): Promise<PosBill>;
  /** Notify the POS that a bill was paid (PAYMENT_CONFIRM direction). */
  confirmPayment(params: ConfirmPaymentParams): Promise<void>;
  healthCheck(restaurantId: string): Promise<{ ok: boolean; detail?: string }>;
}

export class PosError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "PosError";
  }
}
