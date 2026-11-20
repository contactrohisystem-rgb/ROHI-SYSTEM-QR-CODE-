import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

// Validates the area belongs to a floor plan owned by the caller's restaurant.
async function getOwnedArea(id: string, restaurantId: string) {
  return db.area.findFirst({
    where: { id, floorPlan: { restaurantId } },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const area = await getOwnedArea(id, auth.ctx.restaurantId);
  if (!area) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const updated = await db.area.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ area: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const area = await getOwnedArea(id, auth.ctx.restaurantId);
  if (!area) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Tables in this area get areaId = null (SetNull). They keep their `area`
  // string for display.
  await db.area.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
