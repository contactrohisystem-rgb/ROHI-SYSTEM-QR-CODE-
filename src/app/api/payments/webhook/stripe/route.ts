import { NextResponse } from "next/server";
import Stripe from "stripe";
import { handleWebhook } from "@/lib/payments/webhook-handler";

/**
 * POST /api/payments/webhook/stripe
 *
 * Stripe webhook endpoint. Stripe calls this URL on payment_intent.succeeded
 * and payment_intent.payment_failed events.
 *
 * SECURITY: The webhook signature is verified using the Stripe-Signature
 * header and STRIPE_WEBHOOK_SECRET before any payment state is transitioned.
 * A forged request without a valid signature is rejected with 400. This
 * prevents attackers from triggering false payment confirmations.
 *
 * After signature verification, the handler STILL calls verifyPayment()
 * (retrieves the PaymentIntent status from Stripe's API) before transitioning
 * any payment state — defence in depth.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  // If Stripe isn't configured, reject — never process unverified webhooks.
  if (!webhookSecret || !secretKey) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  // Stripe requires the RAW body for signature verification (not parsed JSON).
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "missing_signature" },
      { status: 400 },
    );
  }

  // Verify the webhook signature using the Stripe SDK.
  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    // Invalid signature — reject. Do not disclose whether the secret exists.
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 400 },
    );
  }

  // Only process payment_intent events; ignore others.
  if (
    event.type !== "payment_intent.succeeded" &&
    event.type !== "payment_intent.payment_failed"
  ) {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const eventData = event.data.object as unknown as Record<string, unknown>;
  return handleWebhook("CARD", eventData, event.id);
}
