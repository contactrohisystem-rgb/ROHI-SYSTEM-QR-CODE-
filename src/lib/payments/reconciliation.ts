import { db } from "@/lib/db";
import { PaymentStatus } from "@prisma/client";
import { getProvider } from "./registry";
import { transitionPaymentFromVerification } from "./service";

// A payment is considered "stuck" (reconciliation candidate) if it has been
// INITIATED/PENDING longer than this. Dev: short so the worker can be observed
// recovering missed confirmations. Production: longer (e.g. 10 min) to give
// the provider webhook time to arrive.
const STALE_AFTER_MS = Number(process.env.ROHI_RECONCILE_STALE_MS ?? 20_000);

/**
 * Reconciliation worker: find payments stuck in INITIATED/PENDING past the
 * stale threshold and resolve them via AUTHORITATIVE server-side verification.
 *
 * This recovers from missed webhooks — the payment succeeded at the provider
 * but ROHI never received the confirmation callback. For each stuck payment,
 * query the provider's transaction status and transition SUCCEEDED/FAILED
 * accordingly (the same transition path as the webhook handler).
 */
export async function reconcilePayments(): Promise<{ reconciled: number }> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const stuck = await db.payment.findMany({
    where: {
      status: { in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      initiatedAt: { lt: cutoff },
      providerPaymentId: { not: null },
    },
    select: {
      id: true,
      providerCode: true,
      providerPaymentId: true,
    },
    take: 50,
  });

  let reconciled = 0;
  for (const p of stuck) {
    if (!p.providerPaymentId) continue;
    const provider = getProvider(p.providerCode);
    if (!provider) {
      await db.paymentEvent
        .create({
          data: {
            paymentId: p.id,
            eventType: "reconcile_skipped",
            payload: JSON.stringify({ reason: "provider_unavailable" }),
          },
        })
        .catch(() => {});
      continue;
    }
    try {
      const verification = await provider.verifyPayment(p.providerPaymentId);
      await transitionPaymentFromVerification(p.id, verification);
      reconciled++;
    } catch (e) {
      await db.paymentEvent
        .create({
          data: {
            paymentId: p.id,
            eventType: "reconcile_error",
            payload: JSON.stringify({
              error: e instanceof Error ? e.message : "unknown",
            }),
          },
        })
        .catch(() => {});
    }
  }
  return { reconciled };
}
