import { PaymentProviderCode } from "@prisma/client";
import type { PaymentProvider } from "./provider";
import { mockProvider } from "./providers/mock";
import { mpesaProvider, isMpesaConfigured } from "./providers/mpesa";
import { emolaProvider, isEmolaConfigured } from "./providers/emola";
import { cardProvider, isCardConfigured } from "./providers/card";

/**
 * Payment provider registry.
 *
 * MOCK is always available (development/demo).
 * Real providers (MPESA, EMOLA, CARD) register ONLY when their credentials are
 * configured via environment variables. This guarantees guests never see a
 * non-functional payment method — the checkout surfaces only genuinely
 * available options.
 *
 * To activate a real provider, set its env vars (see the adapter files) and
 * restart the server. The method appears automatically.
 */
const providers: Partial<Record<PaymentProviderCode, PaymentProvider>> = {
  MOCK: mockProvider,
};

if (isMpesaConfigured()) providers.MPESA = mpesaProvider;
if (isEmolaConfigured()) providers.EMOLA = emolaProvider;
if (isCardConfigured()) providers.CARD = cardProvider;

export function getProvider(code: PaymentProviderCode): PaymentProvider | null {
  return providers[code] ?? null;
}

export function availableProviderCodes(): PaymentProviderCode[] {
  return Object.keys(providers) as PaymentProviderCode[];
}

/**
 * Metadata for the checkout UI. Each entry maps a provider code to its display
 * label, description, and whether it's a demo/development method. The checkout
 * shows only methods whose code is in the registry.
 */
export interface PaymentMethodInfo {
  code: PaymentProviderCode;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  isDemo: boolean;
  requiresPhone: boolean;
}

const METHOD_INFO: Record<PaymentProviderCode, PaymentMethodInfo> = {
  MOCK: {
    code: "MOCK",
    label: "M-Pesa",
    labelEn: "M-Pesa",
    description: "Modo demonstração — sem credenciais reais.",
    descriptionEn: "Demonstration mode — no real credentials.",
    isDemo: true,
    requiresPhone: true,
  },
  MPESA: {
    code: "MPESA",
    label: "M-Pesa",
    labelEn: "M-Pesa",
    description: "Vodacom M-Pesa — receberá um pedido no seu telemóvel.",
    descriptionEn: "Vodacom M-Pesa — you'll receive a prompt on your phone.",
    isDemo: false,
    requiresPhone: true,
  },
  EMOLA: {
    code: "EMOLA",
    label: "e-Mola",
    labelEn: "e-Mola",
    description: "Movitel e-Mola — receberá um pedido no seu telemóvel.",
    descriptionEn: "Movitel e-Mola — you'll receive a prompt on your phone.",
    isDemo: false,
    requiresPhone: true,
  },
  CARD: {
    code: "CARD",
    label: "Cartão",
    labelEn: "Card",
    description: "Visa / Mastercard via Stripe.",
    descriptionEn: "Visa / Mastercard via Stripe.",
    isDemo: false,
    requiresPhone: false,
  },
};

export function availablePaymentMethods(): PaymentMethodInfo[] {
  return availableProviderCodes().map((code) => METHOD_INFO[code]).filter(Boolean);
}
