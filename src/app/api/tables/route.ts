import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { generateOpaqueToken } from "@/lib/tokens";

const createSchema = z.object({
  label: z.string().min(1, "Label required").max(60),
  area: z.string().max(60).optional().nullable(),
  shape: z.enum(["round", "square", "rect", "booth"]).optional(),
  seats: z.number().int().min(1).max(20).optional(),
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
});

// GET /api/tables — list tables for the active restaurant (MANAGER+).
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const tables = await db.restaurantTable.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: [{ area: "asc" }, { label: "asc" }],
  });

  return NextResponse.json({ tables });
}

// POST /api/tables — create a table with a fresh opaque token (MANAGER+).
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const table = await db.restaurantTable.create({
    data: {
      restaurantId: auth.ctx.restaurantId,
      label: parsed.data.label,
      area: parsed.data.area ?? null,
      token: generateOpaqueToken("tbl", 16),
      status: "AVAILABLE",
      shape: parsed.data.shape ?? "round",
      seats: parsed.data.seats ?? 4,
      posX: parsed.data.posX ?? 50,
      posY: parsed.data.posY ?? 40,
    },
  });

  return NextResponse.json({ table }, { status: 201 });
}
