import { PaymentProviderCode } from "@prisma/client";
import type { PaymentProvider } from "./provider";
import { mockProvider } from "./providers/mock";
import { mpesaProvider, isMpesaConfigured } from "./providers/mpesa";
import { emolaProvider, isEmolaConfigured } from "./providers/emola";
import { cardProvider, isCardConfigured } from "./providers/card";
import { cashProvider } from "./providers/cash";

/**
 * Payment provider registry.
 *
 * MOCK is always available (development/demo).
 * CASH is always registered (availability is controlled per-restaurant via
 *   cashEnabled/codEnabled flags — the restaurant config decides whether the
 *   method appears in the checkout).
 * Real digital providers (MPESA, EMOLA, CARD) register ONLY when their
 * credentials are configured via environment variables AND the restaurant has
 * enabled them.
 */
const providers: Partial<Record<PaymentProviderCode, PaymentProvider>> = {
  MOCK: mockProvider,
  CASH: cashProvider,
};

if (isMpesaConfigured()) providers.MPESA = mpesaProvider;
if (isEmolaConfigured()) providers.EMOLA = emolaProvider;
if (isCardConfigured()) providers.CARD = cardProvider;

export function getProvider(code: PaymentProviderCode): PaymentProvider | null {
  return providers[code] ?? null;
}

export function isProviderRegistered(code: PaymentProviderCode): boolean {
  return code in providers;
}

export function availableProviderCodes(): PaymentProviderCode[] {
  return Object.keys(providers) as PaymentProviderCode[];
}

export interface PaymentMethodInfo {
  code: PaymentProviderCode;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  isDemo: boolean;
  requiresPhone: boolean;
  isCash: boolean;
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
    isCash: false,
  },
  MPESA: {
    code: "MPESA",
    label: "M-Pesa",
    labelEn: "M-Pesa",
    description: "Vodacom M-Pesa — receberá um pedido no seu telemóvel.",
    descriptionEn: "Vodacom M-Pesa — you'll receive a prompt on your phone.",
    isDemo: false,
    requiresPhone: true,
    isCash: false,
  },
  EMOLA: {
    code: "EMOLA",
    label: "e-Mola",
    labelEn: "e-Mola",
    description: "Movitel e-Mola — receberá um pedido no seu telemóvel.",
    descriptionEn: "Movitel e-Mola — you'll receive a prompt on your phone.",
    isDemo: false,
    requiresPhone: true,
    isCash: false,
  },
  CARD: {
    code: "CARD",
    label: "Cartão",
    labelEn: "Card",
    description: "Visa / Mastercard.",
    descriptionEn: "Visa / Mastercard.",
    isDemo: false,
    requiresPhone: false,
    isCash: false,
  },
  CASH: {
    code: "CASH",
    label: "Dinheiro",
    labelEn: "Cash",
    description: "Pague em dinheiro ao empregado.",
    descriptionEn: "Pay cash to the server.",
    isDemo: false,
    requiresPhone: false,
    isCash: true,
  },
};

/** Globally available methods (all registered providers). */
export function availablePaymentMethods(): PaymentMethodInfo[] {
  return availableProviderCodes().map((code) => METHOD_INFO[code]).filter(Boolean);
}

/**
 * Restaurant-scoped available methods. Filters by the restaurant's per-method
 * enable flags AND the global provider registration (digital providers must
 * have credentials configured). CASH is controlled by cashEnabled; COD (also
 * CASH provider but for delivery) is controlled by codEnabled.
 */
export function restaurantPaymentMethods(config: {
  cashEnabled: boolean;
  codEnabled: boolean;
  cardEnabled: boolean;
  mpesaEnabled: boolean;
  emolaEnabled: boolean;
  isDelivery?: boolean;
}): PaymentMethodInfo[] {
  const result: PaymentMethodInfo[] = [];
  // For delivery orders, cash = COD; for dine-in, cash = dine-in cash.
  if (config.isDelivery ? config.codEnabled : config.cashEnabled) {
    if (isProviderRegistered("CASH")) result.push(METHOD_INFO.CASH);
  }
  if (config.mpesaEnabled && isProviderRegistered("MPESA")) result.push(METHOD_INFO.MPESA);
  if (config.emolaEnabled && isProviderRegistered("EMOLA")) result.push(METHOD_INFO.EMOLA);
  if (config.cardEnabled && isProviderRegistered("CARD")) result.push(METHOD_INFO.CARD);
  // Always include MOCK in dev (clearly labelled demo).
  if (isProviderRegistered("MOCK")) result.push(METHOD_INFO.MOCK);
  return result;
}
