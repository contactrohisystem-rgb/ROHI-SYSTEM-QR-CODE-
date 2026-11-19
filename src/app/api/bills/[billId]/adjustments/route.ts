import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import {
  getOwnedOpenBill,
  recomputeBillTotals,
  BillingError,
} from "@/lib/billing";
import { parseDecimalToMinor } from "@/lib/money";

const schema = z.object({
  type: z.enum(["DISCOUNT", "SURCHARGE", "SERVICE", "TAX"]),
  label: z.string().min(1).max(60),
  amount: z.string().min(1), // decimal string, always positive; sign by type
});

// POST /api/bills/[billId]/adjustments — add a discount/surcharge/service/tax.
// DISCOUNT makes the amount negative (subtracts); others are positive (add).
// Guards against driving the bill total below zero (rolls back).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ billId: string }> },
) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const { billId } = await params;
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const parsedAmount = parseDecimalToMinor(parsed.data.amount, bill.currency);
  if (parsedAmount === null || parsedAmount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  const amountMinor =
    parsed.data.type === "DISCOUNT" ? -parsedAmount : parsedAmount;

  try {
    const adjustment = await db.$transaction(async (tx) => {
      const created = await tx.billAdjustment.create({
        data: {
          billId: bill.id,
          type: parsed.data.type,
          label: parsed.data.label,
          amountMinor,
        },
      });
      const totals = await recomputeBillTotals(bill.id, tx);
      // A discount must never drive the total below zero — roll back if so.
      if (totals.totalMinor < 0) {
        throw new BillingError("adjustment_makes_total_negative");
      }
      return created;
    });
    return NextResponse.json({ adjustment }, { status: 201 });
  } catch (e) {
    if (
      e instanceof BillingError &&
      e.code === "adjustment_makes_total_negative"
    ) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
