import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

/**
 * GET /api/kitchen/tickets — returns active kitchen orders (ACCEPTED, PREPARING)
 * with their items grouped by station. Used by the Kitchen Display System.
 * SERVER+ (kitchen staff access).
 */
export async function GET() {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const orders = await db.customerOrder.findMany({
    where: {
      restaurantId: auth.ctx.restaurantId,
      status: { in: ["ACCEPTED", "PREPARING", "READY"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
      table: { select: { label: true } },
    },
  });

  // Resolve each item's kitchen-station routing via its productId. Items with
  // no productId (deleted product) or a null station go to the default queue.
  const productIds = orders.flatMap((o) =>
    o.items.map((i) => i.productId).filter((id): id is string => !!id),
  );
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, kitchenStationId: true },
      })
    : [];
  const stationByProduct = new Map(
    products.map((p) => [p.id, p.kitchenStationId]),
  );
  const ordersWithStation = orders.map((o) => ({
    ...o,
    items: o.items.map((i) => ({
      ...i,
      kitchenStationId: i.productId ? stationByProduct.get(i.productId) ?? null : null,
    })),
  }));

  // Also fetch stations for filtering
  const stations = await db.kitchenStation.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ orders: ordersWithStation, stations });
}

/**
 * PATCH /api/kitchen/items/[id] — update an item's prep status.
 * NEW → PREPARING → READY → COMPLETED
 */
