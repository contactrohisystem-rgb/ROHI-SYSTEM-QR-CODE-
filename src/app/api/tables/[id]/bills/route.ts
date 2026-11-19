import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { openBillOnTable, BillingError } from "@/lib/billing";

// POST /api/tables/[id]/bills — open a new (NATIVE) bill on a table.
// Refuses if the table already has an OPEN bill (one active bill per table).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const { id: tableId } = await params;
  const table = await db.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: auth.ctx.restaurantId },
    select: { id: true },
  });
  if (!table) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const bill = await openBillOnTable({
      tableId,
      restaurantId: auth.ctx.restaurantId,
      source: "NATIVE",
    });
    return NextResponse.json({ bill }, { status: 201 });
  } catch (e) {
    if (e instanceof BillingError) {
      const status =
        e.code === "table_already_has_open_bill" ? 409 : 500;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
