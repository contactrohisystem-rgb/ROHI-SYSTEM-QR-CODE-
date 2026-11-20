import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const createSchema = z.object({ name: z.string().min(1).max(60) });

// GET /api/floor-plans — list floor plans + their areas (MANAGER+).
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const floorPlans = await db.floorPlan.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
    include: { areas: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ floorPlans });
}

// POST /api/floor-plans — create a floor plan (MANAGER+).
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const fp = await db.floorPlan.create({
    data: {
      restaurantId: auth.ctx.restaurantId,
      name: parsed.data.name,
      sortOrder: await db.floorPlan.count({ where: { restaurantId: auth.ctx.restaurantId } }),
    },
    include: { areas: true },
  });
  return NextResponse.json({ floorPlan: fp }, { status: 201 });
}
