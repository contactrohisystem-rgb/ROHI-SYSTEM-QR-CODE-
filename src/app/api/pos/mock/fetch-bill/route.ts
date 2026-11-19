import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { fetchBillFromMockPos } from "@/lib/pos/service";
import { PosError } from "@/lib/pos/adapter";

const schema = z.object({
  tableId: z.string().min(1),
});

// POST /api/pos/mock/fetch-bill — simulate the POS sending a bill for a table
// (BILL_FETCH direction). Creates a POS-sourced bill with items from the mock
// adapter. DEMO ONLY. (MANAGER+)
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // Tenant check: the table must belong to the caller's restaurant.
  const table = await db.restaurantTable.findFirst({
    where: { id: parsed.data.tableId, restaurantId: auth.ctx.restaurantId },
    select: { id: true },
  });
  if (!table) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const bill = await fetchBillFromMockPos({
      tableId: parsed.data.tableId,
      restaurantId: auth.ctx.restaurantId,
    });
    return NextResponse.json({ bill }, { status: 201 });
  } catch (e) {
    if (e instanceof PosError) {
      const status = e.code === "table_has_open_bill" ? 409 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
