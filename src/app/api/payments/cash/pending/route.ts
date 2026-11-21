import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/session";
import { getPendingCashPayments } from "@/lib/payments/cash-service";

/**
 * GET /api/payments/cash/pending — lists pending cash payments awaiting staff
 * collection (SERVER+). Used by the cash-management dashboard panel.
 */
export async function GET() {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const payments = await getPendingCashPayments(auth.ctx.restaurantId);
  return NextResponse.json({ payments });
}
