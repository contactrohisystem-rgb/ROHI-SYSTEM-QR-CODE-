import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import {
  getOwnedOpenBill,
  recomputeBillTotals,
  BillingError,
} from "@/lib/billing";

const patchSchema = z.object({
  quantity: z.number().int().min(1).max(999),
});

// PATCH /api/bills/[billId]/items/[itemId] — change an item's quantity (OPEN
// bills only). Recomputes the item total + bill totals atomically.
export async function PATCH(
  req: Request,
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

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await db.billItem.findFirst({
    where: { id: itemId, billId: bill.id },
    select: { id: true, unitPriceMinor: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const totalMinor = parsed.data.quantity * existing.unitPriceMinor;

  await db.$transaction(async (tx) => {
    await tx.billItem.update({
      where: { id: itemId },
      data: { quantity: parsed.data.quantity, totalMinor },
    });
    await recomputeBillTotals(bill.id, tx);
  });

  return NextResponse.json({ ok: true });
}

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
