import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

/**
 * GET /api/kitchen/stations — list kitchen stations for the active restaurant.
 * Includes a productCount per station. SERVER+.
 */
export async function GET() {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const stations = await db.kitchenStation.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json({
    stations: stations.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      productCount: s._count.products,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

/**
 * POST /api/kitchen/stations — create a kitchen station. MANAGER+.
 */
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const sortOrder = await db.kitchenStation.count({
    where: { restaurantId: auth.ctx.restaurantId },
  });
  const station = await db.kitchenStation.create({
    data: {
      restaurantId: auth.ctx.restaurantId,
      name: parsed.data.name,
      sortOrder,
    },
  });
  return NextResponse.json({ station }, { status: 201 });
}
