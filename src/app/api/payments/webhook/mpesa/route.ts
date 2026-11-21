import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments/webhook-handler";

/**
 * POST /api/payments/webhook/mpesa
 *
 * Vodacom M-Pesa C2B callback. M-Pesa calls this URL (MPESA_CALLBACK_URL) when
 * a customer confirms or declines the USSD payment prompt.
 *
 * The handler dedupes via WebhookReceipt and ALWAYS calls verifyPayment()
 * (authoritative server-side query) before transitioning any payment state.
 * The callback body is never trusted as proof of payment on its own.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const providerEventId =
    (body.output_TransactionID as string) ??
    (body.output_ConversationID as string) ??
    req.headers.get("x-mpesa-event-id") ??
    `mpesa_${Date.now()}`;
  return handleWebhook("MPESA", body, providerEventId);
}
