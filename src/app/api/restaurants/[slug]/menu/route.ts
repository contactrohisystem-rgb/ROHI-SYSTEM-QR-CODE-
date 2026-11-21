import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/restaurants/[slug]/menu — public menu for the landing page.
 *
 * Returns available products grouped by category, with bilingual fields
 * (name/nameEn, description/descriptionEn) and the featured flag. No auth —
 * the slug resolves the tenant. Unavailable products are excluded.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await db.restaurant.findFirst({
    where: { slug, status: "active" },
    select: { id: true, currency: true, reservationsEnabled: true },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const categories = await db.menuCategory.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { available: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          nameEn: true,
          description: true,
          descriptionEn: true,
          priceMinor: true,
          imageUrl: true,
          featured: true,
        },
      },
    },
  });
  return NextResponse.json({ currency: restaurant.currency, categories });
}
