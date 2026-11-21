import { PaymentStatus } from "@prisma/client";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "../provider";

/**
 * Card payment adapter (Stripe).
 *
 * Integration boundary — activates ONLY when env vars are set:
 *   STRIPE_SECRET_KEY       — the Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — the webhook signing secret (whsec_...)
 *
 * Until configured, this adapter is NOT registered and card payment does NOT
 * appear in the checkout.
 *
 * Flow (real):
 *   initiatePayment → creates a Stripe PaymentIntent (amount in minor units,
 *     currency lowercased). The client-side confirms the payment with the
 *     PaymentIntent client_secret (Stripe.js / Elements). This adapter returns
 *     the PaymentIntent ID as the providerPaymentId.
 *   verifyPayment   → retrieves the PaymentIntent status from Stripe
 *     (authoritative server-side check).
 *   Confirmation arrives via a signed Stripe webhook; the handler verifies the
 *     signature with STRIPE_WEBHOOK_SECRET, then calls verifyPayment.
 *
 * NOTE: the client_secret for Stripe.js confirmation is returned in
 * rawPayload so the checkout can pass it to Stripe Elements.
 */

interface CardConfig {
  secretKey: string;
  webhookSecret: string;
}

function loadConfig(): CardConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return null;
  return { secretKey, webhookSecret };
}

/** True when Stripe credentials are configured (used by the registry). */
export function isCardConfigured(): boolean {
  return loadConfig() !== null;
}

export const cardProvider: PaymentProvider = {
  code: "CARD",
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const config = loadConfig()!;
    const currency = params.currency.toLowerCase();

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${config.secretKey}`,
      },
      body: new URLSearchParams({
        amount: String(params.amountMinor),
        currency,
        "metadata[billId]": params.billId,
        "metadata[paymentId]": params.paymentId,
        "metadata[idempotencyKey]": params.idempotencyKey,
        automatic_payment_methods: "enabled",
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        providerPaymentId: params.paymentId,
        status: PaymentStatus.FAILED,
        rawPayload: JSON.stringify({ error: "card_initiate_failed", response: data }),
      };
    }

    const providerPaymentId = data.id;
    return {
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      rawPayload: JSON.stringify({ clientSecret: data.client_secret, id: data.id }),
    };
  },

  async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult> {
    const config = loadConfig()!;

    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: `Bearer ${config.secretKey}` } },
    );

    const data = await res.json().catch(() => ({}));
    const status = data.status;

    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    if (status === "succeeded") {
      paymentStatus = PaymentStatus.SUCCEEDED;
    } else if (status === "canceled" || status === "failed") {
      paymentStatus = PaymentStatus.FAILED;
    }

    return {
      status: paymentStatus,
      providerPaymentId,
      rawPayload: JSON.stringify(data),
    };
  },
};
