import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const patchSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  area: z.string().max(60).nullable().optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED"]).optional(),
});

// Enforces tenant scoping on the [id] param: the table must belong to the
// caller's active restaurant. Prevents cross-tenant access by id guessing.
async function getOwnedTable(id: string, restaurantId: string) {
  return db.restaurantTable.findFirst({ where: { id, restaurantId } });
}

// PATCH /api/tables/[id] — update label/area/status (MANAGER+).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await getOwnedTable(id, auth.ctx.restaurantId);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const table = await db.restaurantTable.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ table });
}

// DELETE /api/tables/[id] — delete a table (MANAGER+).
// Refuses to delete tables that have bills (financial data integrity).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await getOwnedTable(id, auth.ctx.restaurantId);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const billCount = await db.bill.count({ where: { tableId: id } });
  if (billCount > 0) {
    return NextResponse.json(
      { error: "table_has_bills", count: billCount },
      { status: 400 },
    );
  }

  await db.restaurantTable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
