import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * PATCH /api/kitchen/stations/[id] — rename or reorder a kitchen station.
 * MANAGER+. Validates ownership (restaurantId).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const station = await db.kitchenStation.findFirst({
    where: { id, restaurantId: auth.ctx.restaurantId },
  });
  if (!station)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const updated = await db.kitchenStation.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ station: updated });
}

/**
 * DELETE /api/kitchen/stations/[id] — delete a station. Products linked to it
 * are SetNull (revert to the default queue). MANAGER+.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const station = await db.kitchenStation.findFirst({
    where: { id, restaurantId: auth.ctx.restaurantId },
  });
  if (!station)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.kitchenStation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
