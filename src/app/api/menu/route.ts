import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

/**
 * GET /api/menu — returns the active restaurant's menu (categories + products).
 * Two modes:
 *   - Staff: requires MANAGER+ auth. Returns all products (including unavailable).
 *   - Guest: pass ?tableToken=<opaque> — resolves the token → restaurant.
 *     Returns only available products. No auth required (the token is the credential).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tableToken = url.searchParams.get("tableToken");

  if (tableToken) {
    // Guest mode — resolve the table token → restaurant.
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: { select: { id: true, status: true } } },
    });
    if (!table || table.restaurant.status !== "active") {
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    }
    const categories = await db.menuCategory.findMany({
      where: { restaurantId: table.restaurant.id },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { available: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, nameEn: true, description: true, descriptionEn: true, priceMinor: true, imageUrl: true, featured: true },
        },
      },
    });
    return NextResponse.json({ categories });
  }

  // Staff mode — MANAGER+.
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const categories = await db.menuCategory.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
    include: {
      products: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ categories });
}

// POST /api/menu/categories — create a category (MANAGER+).
const catSchema = z.object({ name: z.string().min(1).max(60) });
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = catSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const cat = await db.menuCategory.create({
    data: {
      restaurantId: auth.ctx.restaurantId,
      name: parsed.data.name,
      sortOrder: await db.menuCategory.count({ where: { restaurantId: auth.ctx.restaurantId } }),
    },
  });
  return NextResponse.json({ category: cat }, { status: 201 });
}
