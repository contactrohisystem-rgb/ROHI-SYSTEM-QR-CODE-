import { db } from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { BillingError } from "@/lib/billing";

/**
 * Cash collection service.
 *
 * Handles staff-confirmed cash payments for both dine-in and cash-on-delivery.
 * The staff member enters the amount received; the server calculates change
 * and transitions the payment to SUCCEEDED — never the client.
 *
 * Security:
 *   - Only authorised staff (SERVER+) can confirm.
 *   - Tenant isolation: the payment must belong to the caller's restaurant.
 *   - Idempotency: one collection per payment (unique constraint).
 *   - Transactional: the collection record + payment transition + bill closure
 *     happen in one DB transaction.
 *   - The payment is only marked SUCCEEDED after the collection record is
 *     written — never before.
 */

export interface CashCollectionResult {
  ok: boolean;
  error?: string;
  collection?: {
    id: string;
    amountDueMinor: number;
    amountReceivedMinor: number;
    changeMinor: number;
    currency: string;
    collectionType: string;
  };
}

export async function confirmCashCollection(params: {
  staffUserId: string;
  restaurantId: string;
  paymentId: string;
  amountReceivedMinor: number;
  collectionType: "DINE_IN" | "CASH_ON_DELIVERY";
  auditReference?: string;
}): Promise<CashCollectionResult> {
  const { staffUserId, restaurantId, paymentId, amountReceivedMinor, collectionType, auditReference } = params;

  if (amountReceivedMinor < 0) {
    return { ok: false, error: "invalid_amount" };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Lock the payment + validate ownership and state.
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, restaurantId },
        include: { cashCollection: true, bill: true },
      });
      if (!payment) return { error: "payment_not_found" };
      if (payment.providerCode !== "CASH") return { error: "not_cash_payment" };
      if (payment.cashCollection) return { error: "already_collected" };
      if (payment.status === PaymentStatus.SUCCEEDED) return { error: "already_paid" };
      if (payment.status === PaymentStatus.CANCELLED) return { error: "cancelled" };

      const amountDueMinor = payment.amountMinor;
      const changeMinor = amountReceivedMinor - amountDueMinor;

      // Allow exact or over-payment (customer pays enough). Under-payment is
      // rejected — the staff must receive at least the amount due.
      if (amountReceivedMinor < amountDueMinor) {
        return { error: "insufficient_amount", amountDueMinor, amountReceivedMinor };
      }

      // Create the collection record.
      const collection = await tx.cashCollection.create({
        data: {
          paymentId,
          restaurantId,
          collectionType,
          staffUserId,
          amountDueMinor,
          amountReceivedMinor,
          changeMinor,
          currency: payment.currency,
          auditReference: auditReference ?? null,
        },
      });

      // Transition payment to SUCCEEDED.
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          confirmedAt: new Date(),
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId,
          eventType: "cash_collected",
          statusFrom: payment.status,
          statusTo: "SUCCEEDED",
          payload: JSON.stringify({
            collectionId: collection.id,
            amountReceivedMinor,
            changeMinor,
            staffUserId,
            collectionType,
          }),
        },
      });

      // Close the bill (PAID) — the payment engine sets this, not billing.
      await tx.bill.update({
        where: { id: payment.billId },
        data: { status: "PAID", closedAt: new Date() },
      });

      return {
        collection: {
          id: collection.id,
          amountDueMinor,
          amountReceivedMinor,
          changeMinor,
          currency: payment.currency,
          collectionType,
        },
      };
    });

    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, collection: result.collection };
  } catch (err) {
    return { ok: false, error: "collection_failed" };
  }
}

/**
 * List pending cash payments for a restaurant (staff dashboard / cash management).
 * Returns CASH payments that haven't been collected yet.
 */
export async function getPendingCashPayments(restaurantId: string) {
  const payments = await db.payment.findMany({
    where: {
      restaurantId,
      providerCode: "CASH",
      status: { in: [PaymentStatus.PENDING, PaymentStatus.INITIATED] },
    },
    include: {
      bill: { include: { table: { select: { label: true } }, items: { select: { name: true, quantity: true, totalMinor: true } } } },
      cashCollection: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return payments;
}
