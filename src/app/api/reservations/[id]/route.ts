import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import {
  findTableConflicts,
  isTransitionAllowed,
  reservationWindow,
  windowsOverlap,
} from "@/lib/reservations";

const VALID_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

const patchSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  tableId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  // Optional: staff proposes an alternative time (reschedule). Shifts the
  // reservation date + duration and returns to PENDING for guest re-confirm.
  newDate: z.string().optional(),
  newDurationMins: z.number().int().min(30).max(240).optional(),
});

/**
 * PATCH /api/reservations/[id] — staff updates a reservation.
 *
 * Stage 12C hardening:
 *   - Status transitions are validated against the allowed state machine.
 *   - Table assignment is transactional and checks BOTH capacity (seats >=
 *     partySize) AND overlapping reservations on the same table.
 *   - A table currently OCCUPIED by an active dining bill cannot be set to
 *     RESERVED by a seating action unless staff explicitly chooses it — the
 *     reservation's table status side-effect is skipped if the table has an
 *     OPEN/PENDING_PAYMENT bill (the live dining session wins).
 *   - When SEATED, the table is marked RESERVED; on COMPLETED/CANCELLED/NO_SHOW
 *     the table is freed to AVAILABLE only if it has no active dining bill and
 *     is currently RESERVED.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const reservation = await db.reservation.findFirst({
    where: { id, restaurantId: auth.ctx.restaurantId },
    include: { table: { select: { id: true, label: true, seats: true, status: true } } },
  });
  if (!reservation)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { status, tableId, notes, newDate, newDurationMins } = parsed.data;

  // Validate status transition (Stage 12A).
  if (status && !isTransitionAllowed(reservation.status, status)) {
    return NextResponse.json(
      { error: "invalid_transition", from: reservation.status, to: status },
      { status: 400 },
    );
  }

  // Reschedule (staff proposes alternative time).
  let resolvedDate = reservation.date;
  let resolvedDuration = reservation.durationMins;
  if (newDate) {
    const d = new Date(newDate);
    if (Number.isNaN(d.getTime()))
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    resolvedDate = d;
    if (newDurationMins) resolvedDuration = newDurationMins;
  }

  // Resolve the target table.
  let resolvedTableId = tableId !== undefined ? tableId : reservation.tableId;

  // Confirming/Seating requires a table.
  if ((status === "CONFIRMED" || status === "SEATED") && resolvedTableId === null) {
    return NextResponse.json({ error: "table_required" }, { status: 400 });
  }

  // Validate table ownership + capacity + conflicts (transactional).
  if (resolvedTableId !== null && resolvedTableId !== undefined) {
    const table = await db.restaurantTable.findFirst({
      where: { id: resolvedTableId, restaurantId: auth.ctx.restaurantId },
      select: { id: true, label: true, seats: true, status: true },
    });
    if (!table)
      return NextResponse.json({ error: "invalid_table" }, { status: 400 });
    if (table.seats < reservation.partySize)
      return NextResponse.json(
        { error: "capacity_exceeded", message: `Table seats ${table.seats}, party is ${reservation.partySize}.` },
        { status: 400 },
      );
  }

  const window = reservationWindow(resolvedDate, resolvedDuration);

  // Run the update + conflict re-check + table-status side-effect atomically.
  try {
    const updated = await db.$transaction(async (tx) => {
      // Re-check table conflict inside the transaction (concurrent-safe).
      if (resolvedTableId) {
        const conflicts = await tx.reservation.findMany({
          where: {
            restaurantId: auth.ctx.restaurantId,
            tableId: resolvedTableId,
            status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
            id: { not: reservation.id },
            date: { lt: window.end },
          },
          select: { date: true, durationMins: true },
        });
        const hasConflict = conflicts.some((c) => {
          const cWindow = reservationWindow(c.date, c.durationMins);
          return windowsOverlap(window, cWindow);
        });
        if (hasConflict) {
          throw new Error("table_conflict");
        }
      }

      const result = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          ...(status ? { status } : {}),
          ...(tableId !== undefined ? { tableId: resolvedTableId } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(newDate ? { date: resolvedDate } : {}),
          ...(newDurationMins ? { durationMins: resolvedDuration } : {}),
        },
        include: { table: { select: { id: true, label: true, area: true, seats: true } } },
      });

      // Table-status side-effects (Stage 12C). A table with an active dining
      // bill keeps its OCCUPIED status — the live session wins over the
      // reservation's RESERVED flag.
      const linkedTableId = resolvedTableId;
      if (linkedTableId) {
        const table = await tx.restaurantTable.findUnique({
          where: { id: linkedTableId },
          select: { id: true, status: true },
        });
        if (table) {
          const hasActiveBill = await tx.bill.findFirst({
            where: { tableId: linkedTableId, status: { in: ["OPEN", "PENDING_PAYMENT"] } },
            select: { id: true },
          });
          if (status === "SEATED" && !hasActiveBill && table.status === "AVAILABLE") {
            await tx.restaurantTable.update({
              where: { id: linkedTableId },
              data: { status: "RESERVED" },
            });
          } else if (status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW") {
            // Free the table only if currently RESERVED (not OCCUPIED by a bill).
            if (table.status === "RESERVED") {
              await tx.restaurantTable.update({
                where: { id: linkedTableId },
                data: { status: "AVAILABLE" },
              });
            }
          }
        }
      }

      return result;
    });
    return NextResponse.json({ reservation: updated });
  } catch (err) {
    const e = err as Error;
    if (e.message === "table_conflict") {
      return NextResponse.json(
        { error: "table_conflict", message: "This table is already reserved for an overlapping time." },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * DELETE is intentionally not exposed — cancellation is a status transition
 * (PATCH status=CANCELLED), preserving the audit trail.
 */
