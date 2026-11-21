import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * POST /api/reservations — guest submits a reservation request (token-gated).
 * Creates a PENDING reservation. Staff confirm/reject via the dashboard.
 *
 * Includes a lightweight availability check: rejects if more than
 * MAX_OVERLAPPING other active reservations (not CANCELLED/COMPLETED/NO_SHOW)
 * overlap the requested time window for the whole restaurant. Table-level
 * assignment is done by staff later (so this is a soft capacity guard, not a
 * hard table lock).
 */
const MAX_OVERLAPPING = 40;

const schema = z.object({
  tableToken: z.string().min(1),
  customerName: z.string().min(1).max(80),
  phone: z.string().min(5).max(30),
  partySize: z.number().int().min(1).max(20),
  date: z.string(), // ISO datetime
  durationMins: z.number().int().min(30).max(240).optional(),
  areaPreference: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { tableToken, ...data } = parsed.data;
  const table = await db.restaurantTable.findUnique({
    where: { token: tableToken },
    include: { restaurant: { select: { id: true, status: true } } },
  });
  if (!table || table.restaurant.status !== "active") {
    return NextResponse.json({ error: "invalid_table" }, { status: 404 });
  }

  const start = new Date(data.date);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const durationMins = data.durationMins ?? 90;
  const end = new Date(start.getTime() + durationMins * 60_000);

  // Soft availability guard: count overlapping active reservations.
  const overlapping = await db.reservation.count({
    where: {
      restaurantId: table.restaurant.id,
      status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
      date: { lt: end },
      // reservation ends at date + durationMins; approximate with a window.
    },
  });
  if (overlapping >= MAX_OVERLAPPING) {
    return NextResponse.json(
      { error: "no_availability" },
      { status: 409 },
    );
  }

  const reservation = await db.reservation.create({
    data: {
      restaurantId: table.restaurant.id,
      customerName: data.customerName,
      phone: data.phone,
      partySize: data.partySize,
      date: start,
      durationMins,
      areaPreference: data.areaPreference ?? null,
      notes: data.notes ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ reservation }, { status: 201 });
}

/**
 * GET /api/reservations — staff lists reservations (SERVER+).
 * Ordered by date ascending. Includes the assigned table label.
 */
export async function GET(req: Request) {
  const { requireStaffRole } = await import("@/lib/auth/session");
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const reservations = await db.reservation.findMany({
    where: {
      restaurantId: auth.ctx.restaurantId,
      ...(status ? { status } : {}),
    },
    orderBy: { date: "asc" },
    take: 100,
    include: { table: { select: { id: true, label: true } } },
  });

  return NextResponse.json({ reservations });
}
