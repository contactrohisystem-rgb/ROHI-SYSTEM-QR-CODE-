import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const createSchema = z.object({
  floorPlanId: z.string().min(1),
  name: z.string().min(1).max(60),
});

// POST /api/areas — create an area within a floor plan (MANAGER+).
// Validates the floor plan belongs to the caller's restaurant.
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  // Validate ownership
  const fp = await db.floorPlan.findFirst({
    where: { id: parsed.data.floorPlanId, restaurantId: auth.ctx.restaurantId },
  });
  if (!fp) return NextResponse.json({ error: "floor_plan_not_found" }, { status: 404 });
  const area = await db.area.create({
    data: {
      floorPlanId: parsed.data.floorPlanId,
      name: parsed.data.name,
      sortOrder: await db.area.count({ where: { floorPlanId: parsed.data.floorPlanId } }),
    },
  });
  return NextResponse.json({ area }, { status: 201 });
}
