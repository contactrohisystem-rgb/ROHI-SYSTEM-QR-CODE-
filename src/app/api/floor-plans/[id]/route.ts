import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

async function getOwned(id: string, restaurantId: string) {
  return db.floorPlan.findFirst({ where: { id, restaurantId } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const fp = await getOwned(id, auth.ctx.restaurantId);
  if (!fp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const updated = await db.floorPlan.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ floorPlan: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const fp = await getOwned(id, auth.ctx.restaurantId);
  if (!fp) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Deleting a floor plan cascades to its areas. Tables in those areas get
  // areaId = null (SetNull) but remain (their `area` string is preserved).
  await db.floorPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
