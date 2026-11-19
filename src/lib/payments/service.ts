import { db } from "@/lib/db";
import { PaymentProviderCode, PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { getProvider } from "./registry";
import { BillingError } from "@/lib/billing";

export class PaymentError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "PaymentError";
  }
}

export interface GuestTableContext {
  tableId: string;
  restaurantId: string;
}

/**
 * Resolve the table from the opaque QR token. The token is the guest's ONLY
 * credential — every guest payment operation re-resolves it so a billId or
 * paymentId alone is never sufficient to act.
 */
export async function resolveGuestTable(
  tableToken: string,
): Promise<GuestTableContext | null> {
  const table = await db.restaurantTable.findUnique({
    where: { token: tableToken },
    include: { restaurant: { select: { id: true, status: true } } },
  });
  if (!table || table.restaurant.status !== "active") return null;
  return {
    tableId: table.id,
    restaurantId: table.restaurant.id,
  };
}

/** Mask a customer identifier (MSISDN) for storage — keep last 4 only. */
function maskIdentifier(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

const ACTIVE_BILL_STATUSES = [
  PaymentStatus.INITIATED,
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED,
  PaymentStatus.SUCCEEDED,
];

export interface InitiateResult {
  paymentId: string;
  providerPaymentId: string;
  status: PaymentStatus;
}

/**
 * Initiate a payment for the guest's active bill.
 *
 * Idempotency: if an in-flight or already-succeeded payment exists for this
 * bill + provider, it is returned as-is (no duplicate charge). Only when the
 * previous attempt is terminal-failed do we create a new Payment.
 */
export async function initiatePaymentForGuest(params: {
  tableToken: string;
  providerCode: PaymentProviderCode;
  customerIdentifier?: string;
}): Promise<InitiateResult> {
  const ctx = await resolveGuestTable(params.tableToken);
  if (!ctx) throw new PaymentError("invalid_table");

  const provider = getProvider(params.providerCode);
  if (!provider) throw new PaymentError("provider_unavailable");

  const bill = await db.bill.findFirst({
    where: { tableId: ctx.tableId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      totalMinor: true,
      currency: true,
      restaurantId: true,
    },
  });
  if (!bill) throw new PaymentError("no_active_bill");

  // Idempotency: an existing non-terminal payment for this bill+provider.
  const existing = await db.payment.findFirst({
    where: {
      billId: bill.id,
      providerCode: params.providerCode,
      status: { in: ACTIVE_BILL_STATUSES },
    },
    select: { id: true, providerPaymentId: true, status: true },
  });
  if (existing) {
    return {
      paymentId: existing.id,
      providerPaymentId: existing.providerPaymentId ?? "",
      status: existing.status,
    };
  }

  // Fresh Payment with a unique idempotency key.
  const idempotencyKey = `bill_${bill.id}_${params.providerCode}_${randomBytes(4).toString("hex")}`;
  const payment = await db.payment.create({
    data: {
      restaurantId: ctx.restaurantId,
      billId: bill.id,
      providerCode: params.providerCode,
      status: PaymentStatus.PENDING,
      amountMinor: bill.totalMinor,
      currency: bill.currency,
      idempotencyKey,
      customerIdentifier: params.customerIdentifier
        ? maskIdentifier(params.customerIdentifier)
        : null,
    },
  });
  await db.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventType: "created",
      statusFrom: null,
      statusTo: "PENDING",
    },
  });

  // Ask the provider to initiate (pushes USSD prompt in real M-Pesa).
  const result = await provider.initiatePayment({
    paymentId: payment.id,
    billId: bill.id,
    amountMinor: bill.totalMinor,
    currency: bill.currency,
    customerIdentifier: params.customerIdentifier
      ? maskIdentifier(params.customerIdentifier)
      : undefined,
    idempotencyKey,
  });

  await db.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: result.providerPaymentId,
      status: result.status,
      initiatedAt: new Date(),
      rawProviderPayload: result.rawPayload ?? null,
    },
  });
  await db.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventType: "initiated",
      statusFrom: "PENDING",
      statusTo: result.status,
      payload: result.rawPayload ?? null,
    },
  });

  return {
    paymentId: payment.id,
    providerPaymentId: result.providerPaymentId,
    status: result.status,
  };
}

/** Poll a payment's status (guest-side, token-gated). */
export async function pollPayment(params: {
  tableToken: string;
  paymentId: string;
}): Promise<{ status: PaymentStatus; providerPaymentId: string | null }> {
  const ctx = await resolveGuestTable(params.tableToken);
  if (!ctx) throw new PaymentError("invalid_table");

  const payment = await db.payment.findFirst({
    where: { id: params.paymentId, bill: { tableId: ctx.tableId } },
    select: { id: true, status: true, providerPaymentId: true },
  });
  if (!payment) throw new PaymentError("payment_not_found");
  return {
    status: payment.status,
    providerPaymentId: payment.providerPaymentId,
  };
}

/**
 * Confirm a MOCK payment — this stands in for the provider's signed webhook
 * arriving with "customer approved". It performs AUTHORITATIVE server-side
 * verification (provider.verifyPayment) BEFORE transitioning any state, then
 * transitions payment -> SUCCEEDED and bill -> PAID atomically.
 *
 * In production the real webhook endpoint validates the provider's signature
 * instead of accepting a paymentId, then calls verifyPayment the same way.
 */
export async function confirmMockPayment(params: {
  tableToken: string;
  paymentId: string;
}): Promise<{ status: PaymentStatus }> {
  const ctx = await resolveGuestTable(params.tableToken);
  if (!ctx) throw new PaymentError("invalid_table");

  const payment = await db.payment.findFirst({
    where: {
      id: params.paymentId,
      bill: { tableId: ctx.tableId },
      providerCode: "MOCK",
    },
    select: { id: true, status: true, providerPaymentId: true, billId: true },
  });
  if (!payment) throw new PaymentError("payment_not_found");
  if (payment.status === PaymentStatus.SUCCEEDED) {
    return { status: PaymentStatus.SUCCEEDED }; // idempotent
  }

  const provider = getProvider("MOCK");
  if (!provider || !payment.providerPaymentId) {
    throw new PaymentError("provider_unavailable");
  }

  // Authoritative verification FIRST (outside the transaction so we don't
  // hold a DB lock during a network call in the real provider).
  const verification = await provider.verifyPayment(payment.providerPaymentId);

  // Transition atomically; re-read to handle concurrent confirmations.
  await db.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });
    if (!current || current.status === PaymentStatus.SUCCEEDED) return;

    if (verification.status === PaymentStatus.SUCCEEDED) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          confirmedAt: new Date(),
          rawProviderPayload: verification.rawPayload ?? null,
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: "verified",
          statusFrom: current.status,
          statusTo: "SUCCEEDED",
          payload: verification.rawPayload ?? null,
        },
      });
      // The PAYMENT ENGINE sets the bill to PAID — never the billing module.
      await tx.bill.update({
        where: { id: payment.billId },
        data: { status: "PAID", closedAt: new Date() },
      });
    } else if (verification.status === PaymentStatus.FAILED) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedReason: "provider_verify_failed",
          rawProviderPayload: verification.rawPayload ?? null,
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: "failed",
          statusFrom: current.status,
          statusTo: "FAILED",
          payload: verification.rawPayload ?? null,
        },
      });
    }
  });

  const updated = await db.payment.findUnique({
    where: { id: payment.id },
    select: { status: true },
  });
  return { status: updated?.status ?? PaymentStatus.PENDING };
}

// Re-export so callers don't need to import BillingError from billing.
export { BillingError };
