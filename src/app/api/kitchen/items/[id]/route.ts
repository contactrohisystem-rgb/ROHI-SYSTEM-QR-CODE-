import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const schema = z.object({
  prepStatus: z.enum(["NEW", "PREPARING", "READY", "COMPLETED"]),
});

/**
 * PATCH /api/kitchen/items/[id] — update an order item's kitchen preparation
 * status (NEW → PREPARING → READY → COMPLETED). SERVER+.
 *
 * When all items in an order reach READY or COMPLETED, the order status is
 * automatically updated to READY (notifying service staff).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Find the item, validate it belongs to the caller's restaurant
  const item = await db.customerOrderItem.findFirst({
    where: {
      id,
      order: { restaurantId: auth.ctx.restaurantId },
    },
    include: {
      order: {
        select: { id: true, status: true, restaurantId: true },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Update the item's prep status
  await db.customerOrderItem.update({
    where: { id },
    data: { prepStatus: parsed.data.prepStatus },
  });

  // Check if all items in the order are READY or COMPLETED
  const allItems = await db.customerOrderItem.findMany({
    where: { orderId: item.order.id },
    select: { prepStatus: true },
  });
  const allReady = allItems.every(
    (i) => i.prepStatus === "READY" || i.prepStatus === "COMPLETED",
  );

  // If all ready and the order is ACCEPTED/PREPARING, update to READY
  if (allReady && allItems.length > 0) {
    if (item.order.status === "ACCEPTED" || item.order.status === "PREPARING") {
      await db.customerOrder.update({
        where: { id: item.order.id },
        data: { status: "READY" },
      });
    }
  } else if (!allReady && item.order.status === "ACCEPTED") {
    // At least one item started preparing → order to PREPARING
    const anyPreparing = allItems.some((i) => i.prepStatus === "PREPARING");
    if (anyPreparing) {
      await db.customerOrder.update({
        where: { id: item.order.id },
        data: { status: "PREPARING" },
      });
    }
  }

  return NextResponse.json({ ok: true, prepStatus: parsed.data.prepStatus });
}
