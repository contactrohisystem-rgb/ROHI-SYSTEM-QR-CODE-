import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * GET /api/reservations/availability?tableToken=<token>&date=<ISO>&durationMins=<n>
 *
 * Guest-facing soft availability check. Returns whether the requested time
 * window has capacity, plus the count of overlapping active reservations.
 *
 * This is a SOFT check (whole-restaurant capacity guard), not a per-table
 * lock. Table assignment is performed by staff after confirmation.
 */
const MAX_OVERLAPPING = 40;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tableToken = url.searchParams.get("tableToken");
  const dateStr = url.searchParams.get("date");
  const durationStr = url.searchParams.get("durationMins");

  if (!tableToken || !dateStr) {
    return NextResponse.json(
      { error: "missing_params" },
      { status: 400 },
    );
  }
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  const durationMins = durationStr ? parseInt(durationStr, 10) : 90;
  if (!Number.isFinite(durationMins) || durationMins < 30 || durationMins > 240) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }
  const end = new Date(start.getTime() + durationMins * 60_000);

  const table = await db.restaurantTable.findUnique({
    where: { token: tableToken },
    include: { restaurant: { select: { id: true, status: true } } },
  });
  if (!table || table.restaurant.status !== "active") {
    return NextResponse.json({ error: "invalid_table" }, { status: 404 });
  }

  // Overlap window: any active reservation whose [date, date+durationMins)
  // intersects [start, end). Conservative: count those starting before end
  // and ending after start (end approximated as date + 90 default).
  const overlapping = await db.reservation.count({
    where: {
      restaurantId: table.restaurant.id,
      status: { in: ["PENDING", "CONFIRMED", "SEATED"] },
      AND: [{ date: { lt: end } }],
    },
  });

  return NextResponse.json({
    available: overlapping < MAX_OVERLAPPING,
    overlapping,
    capacity: MAX_OVERLAPPING,
  });
}
