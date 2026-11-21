import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments/webhook-handler";

/**
 * POST /api/payments/webhook/emola
 *
 * Movitel e-Mola C2B callback. e-Mola calls this URL (EMOLA_CALLBACK_URL) when
 * a customer confirms or declines the payment prompt.
 *
 * Same dedupe + authoritative-verify pattern as the M-Pesa webhook.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const providerEventId =
    (body.transactionId as string) ??
    (body.reference as string) ??
    req.headers.get("x-emola-event-id") ??
    `emola_${Date.now()}`;
  return handleWebhook("EMOLA", body, providerEventId);
}
