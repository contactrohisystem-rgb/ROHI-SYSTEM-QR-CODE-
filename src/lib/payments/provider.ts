import type { PaymentProviderCode, PaymentStatus } from "@prisma/client";

/**
 * Provider-neutral payment provider contract.
 *
 * Every payment provider (M-Pesa, e-Mola, cards, mock) implements this
 * interface. The payment service talks ONLY to this interface, so adding a
 * new provider never touches the payment engine, the bill, or the guest UX.
 *
 * The two operations mirror a C2B mobile-money flow:
 *   1. initiatePayment — request a payment from the customer (pushes a USSD
 *      prompt / redirect in real providers). Returns a providerPaymentId.
 *   2. verifyPayment   — AUTHORITATIVE server-side status check (query the
 *      provider's transaction API). Never trust a client redirect.
 *
 * Confirmation in production arrives via a signed webhook; the webhook
 * handler then calls verifyPayment before transitioning any state.
 */
export interface InitiatePaymentParams {
  paymentId: string;
  billId: string;
  amountMinor: number;
  currency: string;
  customerIdentifier?: string;
  idempotencyKey: string;
}

export interface InitiatePaymentResult {
  providerPaymentId: string;
  status: PaymentStatus; // INITIATED or PENDING
  rawPayload?: string;
}

export interface VerifyPaymentResult {
  status: PaymentStatus; // SUCCEEDED | FAILED | PENDING
  providerPaymentId: string;
  rawPayload?: string;
}

export interface PaymentProvider {
  code: PaymentProviderCode;
  initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult>;
  verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult>;
}
