import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { getOwnedOpenBill, recomputeBillTotals, BillingError } from "@/lib/billing";

// DELETE /api/bills/[billId]/items/[itemId] — remove a line item (OPEN bills
// only) and recompute totals atomically.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ billId: string; itemId: string }> },
) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const { billId, itemId } = await params;
  let bill;
  try {
    bill = await getOwnedOpenBill(billId, auth.ctx.restaurantId);
  } catch (e) {
    if (e instanceof BillingError) {
      const status = e.code === "bill_not_found" ? 404 : 409;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }

  const item = await db.billItem.findFirst({
    where: { id: itemId, billId: bill.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.billItem.delete({ where: { id: itemId } });
    await recomputeBillTotals(bill.id, tx);
  });

  return NextResponse.json({ ok: true });
}
