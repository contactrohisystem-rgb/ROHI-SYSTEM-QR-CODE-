import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const schema = z.object({
  prepStatus: z.enum(["NEW", "PREPARING", "READY", "COMPLETED"]),
});

/**
 * Allowed kitchen preparation status transitions (forward-only).
 * NEW → PREPARING → READY → COMPLETED. COMPLETED is terminal.
 * This is intentionally stricter than the order-level status: an item cannot
 * go backwards (e.g. READY → NEW) once progressed, preventing inconsistent KDS
 * state from concurrent or mistaken taps.
 */
const PREP_TRANSITIONS: Record<string, Set<string>> = {
  NEW: new Set(["PREPARING"]),
  PREPARING: new Set(["READY"]),
  READY: new Set(["COMPLETED"]),
  COMPLETED: new Set([]),
};

function isPrepTransitionAllowed(from: string, to: string): boolean {
  return PREP_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * PATCH /api/kitchen/items/[id] — update an order item's kitchen preparation
 * status (NEW → PREPARING → READY → COMPLETED). SERVER+.
 *
 * Stage 12D hardening:
 *   - Validates the prep-status transition is forward-only.
 *   - The item update + order-status recompute run in one transaction so the
 *     "order becomes READY only when all items are READY/COMPLETED" invariant
 *     holds even under concurrent updates.
 *   - Restaurant membership is enforced via the item's order relation.
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

  const newStatus = parsed.data.prepStatus;

  // Find the item, validate it belongs to the caller's restaurant.
  const item = await db.customerOrderItem.findFirst({
    where: { id, order: { restaurantId: auth.ctx.restaurantId } },
    include: { order: { select: { id: true, status: true, restaurantId: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Validate the transition.
  if (item.prepStatus === newStatus) {
    // Idempotent: already at the requested status.
    return NextResponse.json({ ok: true, prepStatus: newStatus, unchanged: true });
  }
  if (!isPrepTransitionAllowed(item.prepStatus, newStatus)) {
    return NextResponse.json(
      { error: "invalid_prep_transition", from: item.prepStatus, to: newStatus },
      { status: 400 },
    );
  }

  // Transactional update + order-status recompute.
  const result = await db.$transaction(async (tx) => {
    await tx.customerOrderItem.update({
      where: { id },
      data: { prepStatus: newStatus },
    });

    const allItems = await tx.customerOrderItem.findMany({
      where: { orderId: item.order.id },
      select: { prepStatus: true },
    });
    const allReadyOrCompleted = allItems.length > 0 && allItems.every(
      (i) => i.prepStatus === "READY" || i.prepStatus === "COMPLETED",
    );
    const anyPreparing = allItems.some((i) => i.prepStatus === "PREPARING");

    // Order-level status invariants:
    //  - all items READY/COMPLETED → order READY (if currently ACCEPTED/PREPARING)
    //  - any item PREPARING and order still ACCEPTED → order PREPARING
    //  - never move the order backwards from READY here
    const orderStatus = item.order.status;
    if (allReadyOrCompleted && (orderStatus === "ACCEPTED" || orderStatus === "PREPARING")) {
      await tx.customerOrder.update({
        where: { id: item.order.id },
        data: { status: "READY" },
      });
    } else if (!allReadyOrCompleted && anyPreparing && orderStatus === "ACCEPTED") {
      await tx.customerOrder.update({
        where: { id: item.order.id },
        data: { status: "PREPARING" },
      });
    }

    return { ok: true as const, prepStatus: newStatus };
  });

  return NextResponse.json(result);
}
