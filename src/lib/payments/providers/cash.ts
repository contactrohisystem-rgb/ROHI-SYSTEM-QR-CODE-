import { PaymentStatus } from "@prisma/client";
import type {
  PaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from "../provider";

/**
 * Cash payment provider.
 *
 * Cash payments do not call an external API. The customer selects CASH at
 * checkout; the payment is created as PENDING. An authorised staff member
 * then collects the cash, enters the amount received, and confirms collection
 * via the cash-collection endpoint. Only that server-side staff confirmation
 * (with change calculation) transitions the payment to SUCCEEDED.
 *
 * This adapter exists so the registry treats CASH uniformly with other
 * providers. initiatePayment returns PENDING (awaiting staff collection).
 * verifyPayment returns PENDING until the staff collection endpoint has
 * confirmed — it never auto-succeeds.
 */
export const cashProvider: PaymentProvider = {
  code: "CASH",
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    return {
      providerPaymentId: `cash_${params.paymentId}`,
      status: PaymentStatus.PENDING,
      rawPayload: JSON.stringify({
        provider: "cash",
        paymentId: params.paymentId,
        amountMinor: params.amountMinor,
        customerIdentifier: params.customerIdentifier ?? null,
        awaiting: "staff_collection",
        createdAt: new Date().toISOString(),
      }),
    };
  },
  async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult> {
    // Cash payments are verified by staff collection, not by a provider query.
    // Until the staff collection endpoint confirms, the payment stays PENDING.
    return {
      status: PaymentStatus.PENDING,
      providerPaymentId,
      rawPayload: JSON.stringify({ provider: "cash", awaiting: "staff_collection" }),
    };
  },
};
