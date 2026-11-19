import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { getActiveBillForTable } from "@/lib/billing";

// GET /api/tables/[id]/bills/active — the table's OPEN bill (items +
// adjustments + totals), or { bill: null } if none.
export async function GET(
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

  const bill = await getActiveBillForTable(tableId);
  return NextResponse.json({ bill });
}
