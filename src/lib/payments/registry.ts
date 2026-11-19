import { PaymentProviderCode } from "@prisma/client";
import type { PaymentProvider } from "./provider";
import { mockProvider } from "./providers/mock";

/**
 * Payment provider registry.
 *
 * Add a provider here once its implementation + credentials are ready. The
 * guest checkout UI and payment service resolve providers through this
 * registry only — no provider is hardcoded anywhere else.
 *
 * MOCK is always available (development/demo).
 * MPESA is registered here once the real Vodacom Moçambique adapter +
 * credentials land (Task 6).
 */
const providers: Partial<Record<PaymentProviderCode, PaymentProvider>> = {
  MOCK: mockProvider,
  // MPESA: mpesaProvider,  // enabled when credentials are configured.
};

export function getProvider(code: PaymentProviderCode): PaymentProvider | null {
  return providers[code] ?? null;
}

export function availableProviderCodes(): PaymentProviderCode[] {
  return Object.keys(providers) as PaymentProviderCode[];
}
