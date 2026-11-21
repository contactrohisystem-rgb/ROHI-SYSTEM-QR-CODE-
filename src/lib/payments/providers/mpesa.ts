import { PaymentStatus } from "@prisma/client";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "../provider";

/**
 * Vodacom M-Pesa Moçambique C2B adapter.
 *
 * Integration boundary — activates ONLY when these env vars are set:
 *   MPESA_API_URL       — https://api.sandbox.vm.co.mz (sandbox) or
 *                         https://api.vm.co.mz (production)
 *   MPESA_API_KEY       — the API key from the M-Pesa developer portal
 *   MPESA_PUBLIC_KEY    — the public key for Bearer token generation
 *   MPESA_SP_CODE       — the service-provider code (e.g. 171717)
 *   MPESA_CALLBACK_URL  — the public HTTPS URL M-Pesa calls on confirmation
 *
 * Until credentials are configured, this adapter is NOT registered and the
 * M-Pesa method does NOT appear in the checkout. This guarantees guests never
 * see a non-functional payment method.
 *
 * Flow (real):
 *   initiatePayment → POST /ipg/v1x/c2bPayment/singleStage
 *     pushes a USSD prompt to the customer's phone; returns a transaction ID.
 *   verifyPayment   → GET /ipg/v1x/transaction/{id}
 *     authoritative server-side status query.
 *   Confirmation arrives via a SIGNED POST to MPESA_CALLBACK_URL; the webhook
 *   handler validates the origin + signature, then calls verifyPayment before
 *   transitioning any payment state.
 */

interface MpesaConfig {
  apiUrl: string;
  apiKey: string;
  publicKey: string;
  spCode: string;
  callbackUrl: string;
}

function loadConfig(): MpesaConfig | null {
  const apiUrl = process.env.MPESA_API_URL;
  const apiKey = process.env.MPESA_API_KEY;
  const publicKey = process.env.MPESA_PUBLIC_KEY;
  const spCode = process.env.MPESA_SP_CODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  if (!apiUrl || !apiKey || !publicKey || !spCode || !callbackUrl) return null;
  return { apiUrl, apiKey, publicKey, spCode, callbackUrl };
}

/** True when M-Pesa credentials are configured (used by the registry). */
export function isMpesaConfigured(): boolean {
  return loadConfig() !== null;
}

/**
 * Generate the M-Pesa Bearer token (Vodacom Moçambique C2B API).
 *
 * The token is a JWT signed with RS256 using the public key provided by the
 * M-Pesa developer portal. The payload's `iss` (issuer) claim is the API key.
 * `jsonwebtoken` adds `iat` and `exp` automatically — do not set them manually
 * (a manual `iat` can conflict with the library's own timestamp).
 *
 * The public key must be PEM-formatted (the portal provides a DER certificate
 * that must be converted: `openssl x509 -inform DER -in api.cer -pubkey
 * -noout > public_key.pem`). The lazy `import("jsonwebtoken")` keeps the
 * Node-only dependency out of the Edge Runtime bundle — this function only
 * runs inside API routes (Node runtime) when M-Pesa is configured.
 *
 * Secrets are never logged: the token, API key, and public key are used only
 * for the HTTP Authorization header and never persisted to the database.
 */
async function getBearerToken(config: MpesaConfig): Promise<string> {
  const jwt = await import("jsonwebtoken");
  const token = jwt.sign(
    { iss: config.apiKey },
    config.publicKey,
    { algorithm: "RS256", expiresIn: "5m" },
  );
  return `Bearer ${token}`;
}

export const mpesaProvider: PaymentProvider = {
  code: "MPESA",
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const config = loadConfig()!;
    const amountDecimal = (params.amountMinor / 100).toFixed(2);
    const bearer = await getBearerToken(config);

    const body = {
      input_TransactionReference: params.paymentId,
      input_CustomerMSISDN: params.customerIdentifier ?? "",
      input_Amount: amountDecimal,
      input_ThirdPartyReference: params.billId,
      inputServiceProviderCode: config.spCode,
      input_Currency: params.currency,
      input_PaymentType: "C2B",
      input_CallbackURL: config.callbackUrl,
    };

    const res = await fetch(`${config.apiUrl}/ipg/v1x/c2bPayment/singleStage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearer,
        "Origin": config.callbackUrl,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        providerPaymentId: params.paymentId,
        status: PaymentStatus.FAILED,
        rawPayload: JSON.stringify({ error: "mpesa_initiate_failed", response: data }),
      };
    }

    const providerPaymentId = data.output_TransactionID ?? data.output_ConversationID ?? params.paymentId;
    return {
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      rawPayload: JSON.stringify(data),
    };
  },

  async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult> {
    const config = loadConfig()!;
    const bearer = await getBearerToken(config);

    const res = await fetch(
      `${config.apiUrl}/ipg/v1x/transaction/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: bearer } },
    );

    const data = await res.json().catch(() => ({}));
    const status = data.output_ResponseCode ?? data.output_Status;

    // M-Pesa response codes: 0 / "INS-0" = success.
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    if (status === 0 || status === "INS-0" || status === "Completed") {
      paymentStatus = PaymentStatus.SUCCEEDED;
    } else if (status && status !== "Pending" && status !== "PendingConfirmation") {
      paymentStatus = PaymentStatus.FAILED;
    }

    return {
      status: paymentStatus,
      providerPaymentId,
      rawPayload: JSON.stringify(data),
    };
  },
};
