import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { parseDecimalToMinor } from "@/lib/money";

const createSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  price: z.string().min(1), // decimal string, parsed to minor server-side
  imageUrl: z.string().url().optional(),
  available: z.boolean().optional(),
});

// POST /api/menu/products — create a product (MANAGER+).
// Validates the category belongs to the caller's restaurant.
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  // Validate category ownership
  const cat = await db.menuCategory.findFirst({
    where: { id: parsed.data.categoryId, restaurantId: auth.ctx.restaurantId },
  });
  if (!cat) return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  // Parse price to minor units
  const priceMinor = parseDecimalToMinor(parsed.data.price);
  if (priceMinor === null || priceMinor < 0)
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  const product = await db.product.create({
    data: {
      restaurantId: auth.ctx.restaurantId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      priceMinor,
      imageUrl: parsed.data.imageUrl ?? null,
      available: parsed.data.available ?? true,
      sortOrder: await db.product.count({ where: { categoryId: parsed.data.categoryId } }),
    },
  });
  return NextResponse.json({ product }, { status: 201 });
}
