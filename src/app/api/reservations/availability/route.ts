import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findAvailableSlots, findAvailableTables, reservationWindow, validateReservationPolicy, type ReservationPolicy } from "@/lib/reservations";

/**
 * GET /api/reservations/availability
 *
 * Two modes:
 *   1. Single-window check: ?restaurantSlug=<slug>&date=<ISO>&durationMins=<n>&partySize=<n>
 *      Returns { available: boolean, availableTables: number } for that window.
 *   2. Slot listing: ?restaurantSlug=<slug>&date=<YYYY-MM-DD>&partySize=<n>&mode=slots
 *      Returns { slots: [{ time, availableTables }] } for the day.
 *
 * Also accepts tableToken instead of restaurantSlug for the table-QR booking flow.
 *
 * This is a real availability calculation: a window is available iff at least
 * one table (capacity >= partySize, area preference honoured) has no overlapping
 * active reservation. Operating hours + policy are enforced.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantSlug = url.searchParams.get("restaurantSlug");
  const tableToken = url.searchParams.get("tableToken");
  const dateStr = url.searchParams.get("date");
  const durationStr = url.searchParams.get("durationMins");
  const partySizeStr = url.searchParams.get("partySize");
  const areaPreference = url.searchParams.get("areaPreference");
  const mode = url.searchParams.get("mode");

  if (!restaurantSlug && !tableToken) {
    return NextResponse.json({ error: "missing_reference" }, { status: 400 });
  }
  if (!dateStr) {
    return NextResponse.json({ error: "missing_date" }, { status: 400 });
  }

  // Resolve restaurant from slug or table token. Never trust a client id.
  let restaurantId: string;
  if (tableToken) {
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: { select: { id: true, status: true } } },
    });
    if (!table || table.restaurant.status !== "active") {
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    }
    restaurantId = table.restaurant.id;
  } else {
    const restaurant = await db.restaurant.findFirst({
      where: { slug: restaurantSlug!, status: "active" },
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
    }
    restaurantId = restaurant.id;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      reservationsEnabled: true,
      openingHours: true,
      minNoticeMins: true,
      maxAdvanceDays: true,
      maxPartySize: true,
      defaultReservationDurationMins: true,
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
  }

  const partySize = partySizeStr ? parseInt(partySizeStr, 10) : 2;
  if (!Number.isFinite(partySize) || partySize < 1) {
    return NextResponse.json({ error: "invalid_party_size" }, { status: 400 });
  }
  const durationMins = durationStr ? parseInt(durationStr, 10) : restaurant.defaultReservationDurationMins;
  if (!Number.isFinite(durationMins) || durationMins < 30 || durationMins > 240) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }

  // Slot listing mode
  if (mode === "slots") {
    // dateStr is a YYYY-MM-DD; parse as local noon to avoid TZ edge cases.
    const dayDate = new Date(dateStr + "T12:00:00");
    if (Number.isNaN(dayDate.getTime())) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    const slots = await findAvailableSlots(restaurantId, dayDate, partySize, durationMins, areaPreference ?? undefined);
    return NextResponse.json({ slots });
  }

  // Single-window mode
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

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
    return NextResponse.json({ available: false, reason: violation.code, message: violation.message });
  }

  const window = reservationWindow(start, durationMins);
  const tables = await findAvailableTables(restaurantId, window, partySize, areaPreference ?? undefined);

  return NextResponse.json({
    available: tables.length > 0,
    availableTables: tables.length,
  });
}
