import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { parseDecimalToMinor } from "@/lib/money";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

async function getOwned(id: string, restaurantId: string) {
  return db.product.findFirst({ where: { id, restaurantId } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const product = await getOwned(id, auth.ctx.restaurantId);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.price) {
    const priceMinor = parseDecimalToMinor(parsed.data.price);
    if (priceMinor === null || priceMinor < 0)
      return NextResponse.json({ error: "invalid_price" }, { status: 400 });
    data.priceMinor = priceMinor;
    delete data.price;
  }
  const updated = await db.product.update({ where: { id }, data });
  return NextResponse.json({ product: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const product = await getOwned(id, auth.ctx.restaurantId);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
