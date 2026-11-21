import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findAvailableSlots } from "@/lib/reservations";

/**
 * GET /api/restaurants/[slug]/slots?date=YYYY-MM-DD&partySize=<n>&durationMins=<n>&areaPreference=<...>
 *
 * Public available-time listing for the booking page. Resolves the restaurant
 * from the slug, validates it accepts reservations, then delegates to the
 * shared availability engine (operating hours + per-table capacity + overlap).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await db.restaurant.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      reservationsEnabled: true,
      defaultReservationDurationMins: true,
      maxPartySize: true,
      minNoticeMins: true,
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!restaurant.reservationsEnabled) {
    return NextResponse.json({ slots: [], reason: "reservations_disabled" });
  }

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const partySizeStr = url.searchParams.get("partySize");
  const durationStr = url.searchParams.get("durationMins");
  const areaPreference = url.searchParams.get("areaPreference");

  if (!dateStr) {
    return NextResponse.json({ error: "missing_date" }, { status: 400 });
  }
  const dayDate = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(dayDate.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const partySize = partySizeStr ? parseInt(partySizeStr, 10) : 2;
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > restaurant.maxPartySize) {
    return NextResponse.json({ error: "invalid_party_size" }, { status: 400 });
  }
  const durationMins = durationStr ? parseInt(durationStr, 10) : restaurant.defaultReservationDurationMins;

  const slots = await findAvailableSlots(
    restaurant.id,
    dayDate,
    partySize,
    durationMins,
    areaPreference ?? undefined,
  );
  return NextResponse.json({ slots });
}
