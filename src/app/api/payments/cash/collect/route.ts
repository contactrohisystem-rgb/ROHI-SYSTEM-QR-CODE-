import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffRole } from "@/lib/auth/session";
import { confirmCashCollection } from "@/lib/payments/cash-service";

const schema = z.object({
  paymentId: z.string().min(1),
  amountReceivedMinor: z.number().int().min(0),
  collectionType: z.enum(["DINE_IN", "CASH_ON_DELIVERY"]),
  auditReference: z.string().max(100).optional(),
});

/**
 * POST /api/payments/cash/collect — staff confirms cash collection.
 *
 * Authorised staff (SERVER+) enters the amount received; the server calculates
 * change and transitions the payment to SUCCEEDED. Only the server determines
 * success — never the client. Tenant isolation enforced: the payment must
 * belong to the caller's restaurant.
 *
 * Idempotency: one collection per payment (DB unique constraint). Duplicate
 * requests for an already-collected payment return `already_collected`.
 */
export async function POST(req: Request) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await confirmCashCollection({
    staffUserId: auth.ctx.userId,
    restaurantId: auth.ctx.restaurantId,
    paymentId: parsed.data.paymentId,
    amountReceivedMinor: parsed.data.amountReceivedMinor,
    collectionType: parsed.data.collectionType,
    auditReference: parsed.data.auditReference,
  });

  if (!result.ok) {
    const status = result.error === "payment_not_found" ? 404
      : result.error === "already_collected" || result.error === "already_paid" ? 409
      : result.error === "insufficient_amount" ? 400
      : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ collection: result.collection });
}
