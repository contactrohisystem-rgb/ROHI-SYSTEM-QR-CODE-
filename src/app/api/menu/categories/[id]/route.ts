import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().optional(),
});

async function getOwned(id: string, restaurantId: string) {
  return db.menuCategory.findFirst({ where: { id, restaurantId } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const cat = await getOwned(id, auth.ctx.restaurantId);
  if (!cat) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const updated = await db.menuCategory.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ category: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const cat = await getOwned(id, auth.ctx.restaurantId);
  if (!cat) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.menuCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
