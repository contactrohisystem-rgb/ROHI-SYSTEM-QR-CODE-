import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

// POST /api/bills/[billId]/void — void a bill (MANAGER+).
// Only OPEN bills can be voided. Totals are retained for audit.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ billId: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const { billId } = await params;
  const bill = await db.bill.findFirst({
    where: { id: billId, restaurantId: auth.ctx.restaurantId },
    select: { id: true, status: true },
  });
  if (!bill) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (bill.status !== "OPEN") {
    return NextResponse.json({ error: "bill_not_open" }, { status: 409 });
  }

  await db.bill.update({
    where: { id: bill.id },
    data: { status: "VOIDED", voidedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
