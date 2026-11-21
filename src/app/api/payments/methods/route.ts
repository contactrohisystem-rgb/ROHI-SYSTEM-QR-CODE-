import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { restaurantPaymentMethods } from "@/lib/payments/registry";

/**
 * GET /api/payments/methods?tableToken=<token>&isDelivery=<bool>
 *    or /api/payments/methods?restaurantSlug=<slug>&isDelivery=<bool>
 *
 * Returns payment methods available for this specific restaurant, filtered by:
 *   1. The restaurant's per-method enable flags (cashEnabled, codEnabled, etc.)
 *   2. Global provider registration (digital providers need credentials).
 *
 * CASH appears for dine-in when cashEnabled; for delivery when codEnabled.
 * Never shows a method that isn't configured and operational.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tableToken = url.searchParams.get("tableToken");
  const restaurantSlug = url.searchParams.get("restaurantSlug");
  const isDelivery = url.searchParams.get("isDelivery") === "true";

  let restaurantId: string;
  if (tableToken) {
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: { select: { id: true, status: true } } },
    });
    if (!table || table.restaurant.status !== "active") {
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    }
    restaurantId = table.restaurant.id;
  } else if (restaurantSlug) {
    const restaurant = await db.restaurant.findFirst({
      where: { slug: restaurantSlug, status: "active" },
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
    }
    restaurantId = restaurant.id;
  } else {
    // Fallback: global methods (no restaurant context — dev only).
    return NextResponse.json({ methods: restaurantPaymentMethods({
      cashEnabled: true, codEnabled: false, cardEnabled: false, mpesaEnabled: true, emolaEnabled: false,
    })});
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      cashEnabled: true, codEnabled: true, cardEnabled: true,
      mpesaEnabled: true, emolaEnabled: true,
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const methods = restaurantPaymentMethods({ ...restaurant, isDelivery });
  return NextResponse.json({ methods });
}
