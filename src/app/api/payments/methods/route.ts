import { NextResponse } from "next/server";
import { availablePaymentMethods } from "@/lib/payments/registry";

/**
 * GET /api/payments/methods
 *
 * Returns the payment methods that are genuinely available (registered in the
 * provider registry). Real providers (M-Pesa, e-Mola, card) appear only when
 * their credentials are configured via environment variables. The MOCK
 * (demo) method is always present in development.
 *
 * The guest checkout uses this to render only functional payment options —
 * guests never see a non-operational method.
 */
export async function GET() {
  return NextResponse.json({ methods: availablePaymentMethods() });
}
