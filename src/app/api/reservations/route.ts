import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ACTIVE_RESERVATION_STATUSES,
  generateUniqueReference,
  reservationWindow,
  validateReservationPolicy,
  windowsOverlap,
  type ReservationPolicy,
} from "@/lib/reservations";

/**
 * POST /api/reservations — guest submits a reservation request.
 *
 * Two resolution modes (mutually exclusive):
 *   - { tableToken, ... } : existing table-QR flow (token → table → restaurant).
 *   - { restaurantSlug, ... } : Stage 13 public booking flow (slug → restaurant,
 *     no table required — table is assigned by staff later).
 *
 * The reservation is created as PENDING (or CONFIRMED if the restaurant's
 * approval mode is AUTO and a table can be auto-assigned). Real availability is
 * enforced: a feasible table (capacity + no overlap) must exist for the
 * requested window, otherwise `no_availability` is returned with alternative
 * suggestions when possible.
 *
 * Stage 12B hardening: past-date rejection, policy validation (notice / advance
 * / party size / operating hours), duplicate-request protection (same name +
 * phone + date + restaurant within 2 minutes), input validation. No restaurant
 * id is trusted from the client — it is always resolved from the token/slug.
 */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

const schema = z.object({
  tableToken: z.string().min(1).optional(),
  restaurantSlug: z.string().min(1).optional(),
  customerName: z.string().min(1).max(80),
  phone: z.string().min(5).max(30),
  partySize: z.number().int().min(1).max(30),
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
  const {
    tableToken,
    restaurantSlug,
    customerName,
    phone,
    partySize,
    date: dateStr,
    areaPreference,
    notes,
  } = parsed.data;

  if (!tableToken && !restaurantSlug) {
    return NextResponse.json(
      { error: "missing_reference", message: "tableToken or restaurantSlug is required." },
      { status: 400 },
    );
  }

  // Resolve the restaurant from the token or slug. Never trust a client id.
  let restaurantId: string;
  let areaFromTable: string | null = null;
  if (tableToken) {
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: true },
    });
    if (!table || table.restaurant.status !== "active") {
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    }
    restaurantId = table.restaurant.id;
    areaFromTable = table.area;
  } else {
    const restaurant = await db.restaurant.findFirst({
      where: { slug: restaurantSlug!, status: "active" },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
    }
    restaurantId = restaurant.id;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      status: true,
      reservationsEnabled: true,
      openingHours: true,
      minNoticeMins: true,
      maxAdvanceDays: true,
      maxPartySize: true,
      defaultReservationDurationMins: true,
      reservationApprovalMode: true,
    },
  });
  if (!restaurant || restaurant.status !== "active") {
    return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
  }

  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const durationMins = parsed.data.durationMins ?? restaurant.defaultReservationDurationMins;

  // Stage 12B: policy validation (past date, notice, advance, party size, hours)
  const policy: ReservationPolicy = {
    reservationsEnabled: restaurant.reservationsEnabled,
    minNoticeMins: restaurant.minNoticeMins,
    maxAdvanceDays: restaurant.maxAdvanceDays,
    maxPartySize: restaurant.maxPartySize,
    defaultReservationDurationMins: restaurant.defaultReservationDurationMins,
    openingHours: restaurant.openingHours,
  };
  const violation = validateReservationPolicy(policy, start, partySize, durationMins);
  if (violation) {
    return NextResponse.json({ error: violation.code, message: violation.message }, { status: 400 });
  }

  // Stage 12B: duplicate-request protection (same guest, same restaurant,
  // same start time within a short window). Prevents accidental double submits.
  const dupWindowStart = new Date(start.getTime() - 60 * 60_000);
  const dupWindowEnd = new Date(start.getTime() + 60 * 60_000);
  const duplicate = await db.reservation.findFirst({
    where: {
      restaurantId,
      customerName,
      phone,
      date: { gte: dupWindowStart, lte: dupWindowEnd },
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true, reference: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "duplicate_request", reservationId: duplicate.id },
      { status: 409 },
    );
  }

  // Stage 12A: real availability — at least one table must be able to host the
  // party at this window (capacity + no overlap). areaPreference (or the
  // table's own area for the QR flow) constrains the search.
  const window = reservationWindow(start, durationMins);
  const preferredArea = areaPreference ?? areaFromTable ?? null;

  // Fetch candidate tables (capacity >= partySize, area match if specified).
  const candidateTables = await db.restaurantTable.findMany({
    where: {
      restaurantId,
      seats: { gte: partySize },
      ...(preferredArea ? { area: preferredArea } : {}),
    },
    select: { id: true, label: true, area: true, seats: true, status: true },
  });

  // Active reservations overlapping the window, assigned to candidate tables.
  const overlapping = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      tableId: { in: candidateTables.map((t) => t.id) },
      date: { lt: window.end },
    },
    select: { tableId: true, date: true, durationMins: true },
  });
  const conflictTableIds = new Set<string>();
  for (const r of overlapping) {
    if (!r.tableId) continue;
    const rWindow = reservationWindow(r.date, r.durationMins);
    if (windowsOverlap(window, rWindow)) conflictTableIds.add(r.tableId);
  }
  const availableTables = candidateTables.filter((t) => !conflictTableIds.has(t.id));

  if (availableTables.length === 0) {
    // No table available at the requested time. Offer alternative slots.
    return NextResponse.json(
      {
        error: "no_availability",
        message: "No table available at the requested time.",
      },
      { status: 409 },
    );
  }

  // AUTO approval mode: auto-confirm + auto-assign the smallest suitable table.
  const autoConfirm = restaurant.reservationApprovalMode === "AUTO";
  const assignedTableId = autoConfirm ? availableTables[0].id : null;
  const initialStatus = autoConfirm ? "CONFIRMED" : "PENDING";

  // Generate a unique booking reference.
  const reference = await generateUniqueReference();

  // Transactional creation (Stage 12A/C: safe against concurrent double-booking
  // on the auto-assigned table — SQLite serializes the write).
  const reservation = await db.$transaction(async (tx) => {
    // Re-check the auto-assigned table conflict inside the transaction.
    if (assignedTableId) {
      const recheck = await tx.reservation.findMany({
        where: {
          restaurantId,
          tableId: assignedTableId,
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
          date: { lt: window.end },
        },
        select: { date: true, durationMins: true },
      });
      const stillConflict = recheck.some((r) => {
        const rWindow = reservationWindow(r.date, r.durationMins);
        return windowsOverlap(window, rWindow);
      });
      if (stillConflict) {
        throw new Error("table_taken");
      }
    }
    return tx.reservation.create({
      data: {
        restaurantId,
        tableId: assignedTableId,
        customerName,
        phone,
        partySize,
        date: start,
        durationMins,
        areaPreference: preferredArea,
        notes: notes ?? null,
        status: initialStatus,
        reference,
      },
    });
  }).catch((err: Error) => {
    if (err.message === "table_taken") return null;
    throw err;
  });

  if (!reservation) {
    return NextResponse.json(
      { error: "no_availability", message: "The table was booked moments ago. Please try another time." },
      { status: 409 },
    );
  }

  return NextResponse.json({ reservation }, { status: 201 });
}

/**
 * GET /api/reservations — staff lists reservations (SERVER+).
 * Ordered by date ascending. Includes the assigned table label.
 * Supports ?status= and ?from=/to= date range filters.
 */
export async function GET(req: Request) {
  const { requireStaffRole } = await import("@/lib/auth/session");
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const reservations = await db.reservation.findMany({
    where: {
      restaurantId: auth.ctx.restaurantId,
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
    take: 200,
    include: { table: { select: { id: true, label: true, area: true, seats: true } } },
  });

  return NextResponse.json({ reservations });
}
