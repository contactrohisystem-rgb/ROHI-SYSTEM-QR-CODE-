import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PaymentProviderCode } from "@prisma/client";
import { getProvider } from "@/lib/payments/registry";
import { transitionPaymentFromVerification } from "@/lib/payments/service";

/**
 * Shared webhook handler for payment provider callbacks.
 *
 * Provider callbacks are the AUTHORITATIVE confirmation source — the webhook
 * handler always calls verifyPayment() (server-side provider query) before
 * transitioning any payment state. The callback body itself is never trusted
 * as proof of payment.
 *
 * Dedupes via WebhookReceipt so provider redeliveries cannot double-process.
 */
export async function handleWebhook(
  providerCode: PaymentProviderCode,
  body: unknown,
  providerEventId: string,
): Promise<NextResponse> {
  // Dedupe — if we've already processed this provider event, skip.
  const existing = await db.webhookReceipt.findUnique({
    where: {
      providerCode_providerEventId: { providerCode, providerEventId },
    },
  });
  if (existing?.processedStatus === "PROCESSED") {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  // Record the receipt (idempotent insert).
  await db.webhookReceipt.upsert({
    where: {
      providerCode_providerEventId: { providerCode, providerEventId },
    },
    update: { payload: JSON.stringify(body) },
    create: {
      providerCode,
      providerEventId,
      payload: JSON.stringify(body),
      processedStatus: "PENDING",
    },
  });

  // Extract the provider transaction ID from the callback body.
  const data = body as Record<string, unknown>;
  const providerPaymentId =
    (data.output_TransactionID as string) ??
    (data.transactionId as string) ??
    (data.id as string) ??
    ((data.data as Record<string, unknown>)?.id as string) ??
    null;

  if (!providerPaymentId) {
    await db.webhookReceipt.updateMany({
      where: { providerCode, providerEventId },
      data: { processedStatus: "IGNORED", processedAt: new Date() },
    });
    return NextResponse.json({ ok: true, ignored: "no_transaction_id" });
  }

  // Find the payment by the provider's transaction ID.
  const payment = await db.payment.findFirst({
    where: { providerPaymentId, providerCode },
    select: { id: true, status: true },
  });
  if (!payment) {
    await db.webhookReceipt.updateMany({
      where: { providerCode, providerEventId },
      data: { processedStatus: "IGNORED", processedAt: new Date() },
    });
    return NextResponse.json({ ok: true, ignored: "payment_not_found" });
  }

  // AUTHORITATIVE verification — query the provider's API, never trust the
  // callback body alone.
  const provider = getProvider(providerCode);
  if (!provider) {
    return NextResponse.json({ error: "provider_not_registered" }, { status: 500 });
  }

  const verification = await provider.verifyPayment(providerPaymentId);
  await transitionPaymentFromVerification(payment.id, verification);

  await db.webhookReceipt.updateMany({
    where: { providerCode, providerEventId },
    data: { processedStatus: "PROCESSED", processedAt: new Date() },
  });

  return NextResponse.json({ ok: true, status: verification.status });
}
