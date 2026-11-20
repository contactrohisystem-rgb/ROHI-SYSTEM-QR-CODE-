import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { recomputeBillTotals, openBillOnTable } from "@/lib/billing";

const statusSchema = z.object({
  status: z.enum(["RECEIVED", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED", "REJECTED"]),
});

/**
 * PATCH /api/orders/[id] — staff updates an order's status (SERVER+).
 *
 * When status → ACCEPTED: the order's items are added to the table's active
 * bill (creating one if none exists) + totals recomputed. This is the
 * order-to-bill integration — accepted orders feed into the canonical bill.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  // Validate the order belongs to the caller's restaurant
  const order = await db.customerOrder.findFirst({
    where: { id, restaurantId: auth.ctx.restaurantId },
    include: { items: true, table: { select: { id: true } } },
  });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const newStatus = parsed.data.status;

  // If accepting → add items to the bill
  if (newStatus === "ACCEPTED" && order.status !== "ACCEPTED") {
    // Find or create the table's active bill
    let bill = await db.bill.findFirst({
      where: { tableId: order.tableId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    if (!bill) {
      bill = await openBillOnTable({
        tableId: order.tableId,
        restaurantId: auth.ctx.restaurantId,
        source: "NATIVE",
      });
    }
    // Add each order item as a bill item
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        const totalMinor = item.quantity * item.unitPriceMinor;
        await tx.billItem.create({
          data: {
            billId: bill!.id,
            name: item.name,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            totalMinor,
          },
        });
      }
      await recomputeBillTotals(bill!.id, tx);
      await tx.customerOrder.update({
        where: { id: order.id },
        data: { status: newStatus },
      });
    });
    return NextResponse.json({ ok: true, status: newStatus, billId: bill.id });
  }

  // Simple status update for other transitions
  await db.customerOrder.update({
    where: { id: order.id },
    data: { status: newStatus },
  });
  return NextResponse.json({ ok: true, status: newStatus });
}
