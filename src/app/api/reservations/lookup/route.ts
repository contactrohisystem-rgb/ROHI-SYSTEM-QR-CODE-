import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isTransitionAllowed } from "@/lib/reservations";

/**
 * GET /api/reservations/lookup?reference=RSV-XXXXXX
 *
 * Public reservation status lookup. The booking reference is the guest's
 * credential — no auth required. Returns the reservation's non-sensitive
 * details (name, party size, date, status, table label if assigned, restaurant
 * name). Never returns phone, internal ids beyond the reference, or other
 * restaurants' data.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get("reference")?.toUpperCase().trim();
  if (!reference || !/^RSV-[A-Z0-9]{6}$/.test(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }
  const reservation = await db.reservation.findFirst({
    where: { reference },
    include: {
      restaurant: { select: { id: true, name: true, slug: true, address: true, phone: true } },
      table: { select: { label: true, area: true } },
    },
  });
  if (!reservation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    reservation: {
      reference: reservation.reference,
      customerName: reservation.customerName,
      partySize: reservation.partySize,
      date: reservation.date.toISOString(),
      durationMins: reservation.durationMins,
      areaPreference: reservation.areaPreference,
      notes: reservation.notes,
      status: reservation.status,
      tableLabel: reservation.table?.label ?? null,
      tableArea: reservation.table?.area ?? null,
    },
    restaurant: {
      name: reservation.restaurant.name,
      slug: reservation.restaurant.slug,
      address: reservation.restaurant.address,
      phone: reservation.restaurant.phone,
    },
  });
}

const cancelSchema = z.object({ reference: z.string().min(1) });

/**
 * DELETE /api/reservations/lookup — guest cancels their own reservation by
 * reference. Only PENDING / CONFIRMED reservations can be cancelled by guests
 * (once SEATED, staff must handle completion). Validated via the same state
 * machine used by staff.
 */
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const reference = parsed.data.reference.toUpperCase().trim();
  if (!/^RSV-[A-Z0-9]{6}$/.test(reference)) {
    return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
  }

  const reservation = await db.reservation.findFirst({
    where: { reference },
    include: { table: { select: { id: true, status: true } } },
  });
  if (!reservation)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!isTransitionAllowed(reservation.status, "CANCELLED")) {
    return NextResponse.json(
      { error: "cannot_cancel", message: "This reservation can no longer be cancelled online." },
      { status: 400 },
    );
  }

  // Transactional cancellation + free the table if it was RESERVED by this res.
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });
    if (reservation.tableId && reservation.table?.status === "RESERVED") {
      const hasActiveBill = await tx.bill.findFirst({
        where: { tableId: reservation.tableId, status: { in: ["OPEN", "PENDING_PAYMENT"] } },
        select: { id: true },
      });
      if (!hasActiveBill) {
        await tx.restaurantTable.update({
          where: { id: reservation.tableId },
          data: { status: "AVAILABLE" },
        });
      }
    }
    return result;
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
