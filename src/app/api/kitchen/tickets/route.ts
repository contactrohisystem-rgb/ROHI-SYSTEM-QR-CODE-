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
      // Stage 12D: kitchenStationId is snapshotted on each item at order
      // creation time, so routing is stable regardless of later product/station
      // changes. No live product join needed.
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          notes: true,
          prepStatus: true,
          kitchenStationId: true,
        },
      },
      table: { select: { label: true } },
    },
  });

  // Also fetch stations for filtering
  const stations = await db.kitchenStation.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ orders, stations });
}

/**
 * PATCH /api/kitchen/items/[id] — update an item's prep status.
 * NEW → PREPARING → READY → COMPLETED
 */
