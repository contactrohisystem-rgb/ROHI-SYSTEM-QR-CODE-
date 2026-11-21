import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments/webhook-handler";

/**
 * POST /api/payments/webhook/stripe
 *
 * Stripe webhook endpoint. Stripe calls this URL on payment_intent.succeeded
 * and payment_intent.payment_failed events.
 *
 * The Stripe SDK verifies the webhook signature using STRIPE_WEBHOOK_SECRET.
 * This stub reads the event body and delegates to the shared handler which
 * calls verifyPayment() (retrieves the PaymentIntent status) before
 * transitioning any payment state.
 *
 * In production, install `stripe` and verify the signature:
 *   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 *   const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Stripe wraps the data in event.object
  const eventData = body?.data?.object ?? body;
  const providerEventId = body?.id ?? `stripe_${Date.now()}`;
  return handleWebhook("CARD", eventData, providerEventId);
}
