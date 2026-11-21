import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

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
});

/**
 * PATCH /api/reservations/[id] — staff updates a reservation's status and/or
 * assigns a table. SERVER+.
 *
 * Status machine (staff-driven):
 *   PENDING → CONFIRMED (assign table) → SEATED → COMPLETED
 *   PENDING/CONFIRMED → CANCELLED
 *   SEATED → NO_SHOW (optional)
 *
 * When SEATED, the assigned table's status is set to RESERVED (if a table is
 * linked). When COMPLETED/CANCELLED/NO_SHOW, the table is freed back to
 * AVAILABLE (only if currently RESERVED by this reservation).
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
    include: { table: { select: { id: true, label: true, status: true } } },
  });
  if (!reservation)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { status, tableId, notes } = parsed.data;

  // If a table is being assigned, validate ownership.
  let resolvedTableId = tableId !== undefined ? tableId : reservation.tableId;
  if (resolvedTableId !== null) {
    const table = await db.restaurantTable.findFirst({
      where: { id: resolvedTableId, restaurantId: auth.ctx.restaurantId },
      select: { id: true, label: true, status: true },
    });
    if (!table)
      return NextResponse.json({ error: "invalid_table" }, { status: 400 });
  }

  // Confirming/Seating requires a table.
  if (status === "CONFIRMED" || status === "SEATED") {
    if (resolvedTableId === null)
      return NextResponse.json(
        { error: "table_required" },
        { status: 400 },
      );
  }

  const updated = await db.reservation.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(tableId !== undefined ? { tableId: resolvedTableId } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: { table: { select: { id: true, label: true } } },
  });

  // Side-effect on the linked table's status.
  const linkedTableId = resolvedTableId;
  if (linkedTableId) {
    if (status === "SEATED") {
      await db.restaurantTable.update({
        where: { id: linkedTableId },
        data: { status: "RESERVED" },
      });
    } else if (status === "COMPLETED" || status === "CANCELLED" || status === "NO_SHOW") {
      // Free the table if it's currently RESERVED.
      const t = await db.restaurantTable.findUnique({
        where: { id: linkedTableId },
        select: { status: true },
      });
      if (t?.status === "RESERVED") {
        await db.restaurantTable.update({
          where: { id: linkedTableId },
          data: { status: "AVAILABLE" },
        });
      }
    }
  }

  return NextResponse.json({ reservation: updated });
}
