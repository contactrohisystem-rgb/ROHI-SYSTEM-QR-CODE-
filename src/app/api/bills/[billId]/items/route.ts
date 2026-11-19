import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import {
  getOwnedOpenBill,
  recomputeBillTotals,
  computeItemTotal,
  BillingError,
} from "@/lib/billing";
import { parseDecimalToMinor } from "@/lib/money";

const schema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.string().min(1), // decimal string; parsed to minor server-side
});

// POST /api/bills/[billId]/items — add a line item (OPEN bills only).
// Price is accepted as a decimal string and parsed to minor units using the
// money module so no float arithmetic ever occurs.
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

  const unitPriceMinor = parseDecimalToMinor(
    parsed.data.unitPrice,
    bill.currency,
  );
  if (unitPriceMinor === null || unitPriceMinor < 0) {
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  }

  const totalMinor = computeItemTotal(parsed.data.quantity, unitPriceMinor);

  const item = await db.$transaction(async (tx) => {
    const created = await tx.billItem.create({
      data: {
        billId: bill.id,
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        unitPriceMinor,
        totalMinor,
      },
    });
    // Recompute + persist totals atomically with the item insert.
    await recomputeBillTotals(bill.id, tx);
    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}
