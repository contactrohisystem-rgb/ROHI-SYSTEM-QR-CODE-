import { PaymentStatus } from "@prisma/client";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "../provider";

/**
 * e-Mola (Movitel) Moçambique C2B adapter.
 *
 * Integration boundary — activates ONLY when env vars are set:
 *   EMOLA_API_URL       — the e-Mola API base URL
 *   EMOLA_API_KEY       — the API key / client secret
 *   EMOLA_SP_CODE       — the service-provider / merchant code
 *   EMOLA_CALLBACK_URL  — the public HTTPS URL e-Mola calls on confirmation
 *
 * Until configured, this adapter is NOT registered and e-Mola does NOT appear
 * in the checkout.
 *
 * The e-Mola API mirrors a standard mobile-money C2B flow: initiate pushes a
 * USSD prompt; verify queries the transaction status; confirmation arrives via
 * a signed webhook callback.
 */

interface EmolaConfig {
  apiUrl: string;
  apiKey: string;
  spCode: string;
  callbackUrl: string;
}

function loadConfig(): EmolaConfig | null {
  const apiUrl = process.env.EMOLA_API_URL;
  const apiKey = process.env.EMOLA_API_KEY;
  const spCode = process.env.EMOLA_SP_CODE;
  const callbackUrl = process.env.EMOLA_CALLBACK_URL;
  if (!apiUrl || !apiKey || !spCode || !callbackUrl) return null;
  return { apiUrl, apiKey, spCode, callbackUrl };
}

/** True when e-Mola credentials are configured (used by the registry). */
export function isEmolaConfigured(): boolean {
  return loadConfig() !== null;
}

export const emolaProvider: PaymentProvider = {
  code: "EMOLA",
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const config = loadConfig()!;
    const amountDecimal = (params.amountMinor / 100).toFixed(2);

    const body = {
      reference: params.paymentId,
      msisdn: params.customerIdentifier ?? "",
      amount: amountDecimal,
      currency: params.currency,
      merchantCode: config.spCode,
      description: `Bill ${params.billId}`,
      callbackUrl: config.callbackUrl,
    };

    const res = await fetch(`${config.apiUrl}/v1/c2b/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        providerPaymentId: params.paymentId,
        status: PaymentStatus.FAILED,
        rawPayload: JSON.stringify({ error: "emola_initiate_failed", response: data }),
      };
    }

    const providerPaymentId = data.transactionId ?? data.id ?? params.paymentId;
    return {
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      rawPayload: JSON.stringify(data),
    };
  },

  async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult> {
    const config = loadConfig()!;

    const res = await fetch(
      `${config.apiUrl}/v1/c2b/payment/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: `Bearer ${config.apiKey}` } },
    );

    const data = await res.json().catch(() => ({}));
    const status = data.status ?? data.state;

    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") {
      paymentStatus = PaymentStatus.SUCCEEDED;
    } else if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED") {
      paymentStatus = PaymentStatus.FAILED;
    }

    return {
      status: paymentStatus,
      providerPaymentId,
      rawPayload: JSON.stringify(data),
    };
  },
};
