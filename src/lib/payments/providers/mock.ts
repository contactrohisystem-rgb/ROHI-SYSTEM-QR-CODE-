import { PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "../provider";

/**
 * MockProvider — simulates an M-Pesa-style C2B flow for development and demos
 * when no real provider credentials are available.
 *
 * Flow:
 *   initiatePayment() -> returns INITIATED + a fake providerPaymentId
 *                        (represents "USSD prompt pushed to the phone").
 *   verifyPayment()   -> returns SUCCEEDED
 *                        (represents "the customer approved; transaction
 *                        query confirms success").
 *
 * In production, the real MpesaProvider would:
 *   - initiatePayment: call Vodacom M-Pesa C2B payment request API.
 *   - verifyPayment:   call the C2B transaction query API.
 *   - confirmations arrive via a SIGNED webhook (not a button). The webhook
 *     handler validates the signature, then calls verifyPayment before
 *     transitioning state.
 */
export const mockProvider: PaymentProvider = {
  code: "MOCK",
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const providerPaymentId = `mock_${params.paymentId}_${randomBytes(4).toString("hex")}`;
    return {
      providerPaymentId,
      status: PaymentStatus.INITIATED,
      rawPayload: JSON.stringify({
        provider: "mock",
        providerPaymentId,
        amountMinor: params.amountMinor,
        customerIdentifier: params.customerIdentifier ?? null,
        simulated: true,
        createdAt: new Date().toISOString(),
      }),
    };
  },
  async verifyPayment(
    providerPaymentId: string,
  ): Promise<VerifyPaymentResult> {
    return {
      status: PaymentStatus.SUCCEEDED,
      providerPaymentId,
      rawPayload: JSON.stringify({
        provider: "mock",
        providerPaymentId,
        verifiedStatus: "SUCCEEDED",
        verifiedAt: new Date().toISOString(),
      }),
    };
  },
};
