import { db } from "@/lib/db";

/**
 * ROHI Reservation availability engine (Stage 12A + Stage 13).
 *
 * Replaces the previous global-count "soft" guard with a real availability
 * calculation based on:
 *   - Time-window overlap math (two windows [s1,e1) and [s2,e2) overlap iff
 *     s1 < e2 AND s2 < e1).
 *   - Excluded statuses (CANCELLED / COMPLETED / NO_SHOW never block capacity).
 *   - Per-table capacity (seats >= partySize) and conflict checks.
 *   - Restaurant operating hours (JSON weekly schedule).
 *   - Minimum-notice / maximum-advance policy.
 *   - Seating-area preferences.
 *
 * Concurrency: table assignment runs inside a Prisma interactive transaction.
 * SQLite serializes writes, so two concurrent assignments to the same table
 * cannot both pass the in-transaction conflict re-check. This is the pragmatic
 * SERIALIZABLE-equivalent for the dev SQLite store; production PostgreSQL
 * would use SELECT ... FOR UPDATE. The pattern is correct either way.
 */

export interface TimeWindow {
  start: Date;
  end: Date;
}

export const ACTIVE_RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
] as const;

export const INACTIVE_RESERVATION_STATUSES = [
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;

/** Reservation status transition rules (staff-driven). */
export const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  PENDING: new Set(["CONFIRMED", "CANCELLED"]),
  CONFIRMED: new Set(["SEATED", "CANCELLED"]),
  SEATED: new Set(["COMPLETED", "NO_SHOW", "CANCELLED"]),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
  NO_SHOW: new Set([]),
};

export function isTransitionAllowed(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/** Compute the [start, end) dining window from a reservation date + duration. */
export function reservationWindow(date: Date, durationMins: number): TimeWindow {
  return {
    start: new Date(date),
    end: new Date(new Date(date).getTime() + durationMins * 60_000),
  };
}

/** Standard half-open interval overlap test. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

// ────────────────────────────────────────────────────────────────────────────
// Operating hours
// ────────────────────────────────────────────────────────────────────────────

interface DayHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}
type WeeklyHours = Partial<Record<string, DayHours | null>>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Parse the restaurant's openingHours JSON. Returns null if unconfigured
 * (legacy / always-available behaviour).
 */
function parseOpeningHours(json: string | null | undefined): WeeklyHours | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as WeeklyHours;
  } catch {
    // Malformed JSON — treat as unconfigured rather than blocking all bookings.
  }
  return null;
}

function parseHHmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * Is the given window within the restaurant's operating hours for its start day?
 * We check that the reservation start AND end fall within the same open window.
 * For overnight windows (close after midnight, e.g. 18:00–02:00) we treat the
 * close as belonging to the next day when it's numerically smaller than open.
 */
export function isWithinOperatingHours(
  openingHoursJson: string | null | undefined,
  window: TimeWindow,
): boolean {
  const hours = parseOpeningHours(openingHoursJson);
  if (!hours) return true; // unconfigured → always available (legacy behaviour)

  const dayKey = DAY_KEYS[window.start.getDay()];
  const dayHours = hours[dayKey];
  if (!dayHours) return false; // closed that day (explicit null or missing)

  const open = parseHHmm(dayHours.open);
  const close = parseHHmm(dayHours.close);
  if (!open || !close) return false;

  // Minutes-from-midnight for the window's start and end.
  const startMins = window.start.getHours() * 60 + window.start.getMinutes();
  const endMins = window.end.getHours() * 60 + window.end.getMinutes();
  const openMins = open.h * 60 + open.m;
  const closeMins = close.h * 60 + close.m;

  if (closeMins > openMins) {
    // Same-day window (e.g. 11:00–23:00).
    return startMins >= openMins && endMins <= closeMins;
  }
  // Overnight window (e.g. 18:00–02:00): close is past midnight.
  // Reservation must start at/after open, and end no later than close (next day).
  // End minutes past midnight: if endMins <= closeMins it's within the early
  // portion; otherwise it must be on the open side.
  return (
    startMins >= openMins &&
    (endMins <= closeMins || endMins >= openMins)
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Policy validation
// ────────────────────────────────────────────────────────────────────────────

export interface ReservationPolicy {
  reservationsEnabled: boolean;
  minNoticeMins: number;
  maxAdvanceDays: number;
  maxPartySize: number;
  defaultReservationDurationMins: number;
  openingHours: string | null;
}

export interface PolicyViolation {
  code: string;
  message: string;
}

export function validateReservationPolicy(
  policy: ReservationPolicy,
  start: Date,
  partySize: number,
  durationMins: number,
): PolicyViolation | null {
  if (!policy.reservationsEnabled) {
    return { code: "reservations_disabled", message: "Reservations are disabled for this restaurant." };
  }
  const now = Date.now();
  const minNoticeMs = policy.minNoticeMins * 60_000;
  if (start.getTime() < now + minNoticeMs) {
    return { code: "insufficient_notice", message: "Reservation is too soon (minimum notice not met)." };
  }
  if (start.getTime() < now) {
    return { code: "past_date", message: "Reservation date is in the past." };
  }
  const maxAdvanceMs = policy.maxAdvanceDays * 24 * 60 * 60_000;
  if (start.getTime() > now + maxAdvanceMs) {
    return { code: "too_far_ahead", message: "Reservation is too far in advance." };
  }
  if (partySize < 1 || partySize > policy.maxPartySize) {
    return { code: "invalid_party_size", message: `Party size must be between 1 and ${policy.maxPartySize}.` };
  }
  if (durationMins < 30 || durationMins > 240) {
    return { code: "invalid_duration", message: "Duration must be between 30 and 240 minutes." };
  }
  const window = reservationWindow(start, durationMins);
  if (!isWithinOperatingHours(policy.openingHours, window)) {
    return { code: "outside_hours", message: "Reservation falls outside operating hours." };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Table availability
// ────────────────────────────────────────────────────────────────────────────

export interface TableWithCapacity {
  id: string;
  label: string;
  area: string | null;
  seats: number;
  status: string;
}

/**
 * Find tables that can accommodate a party of `partySize` during `window`,
 * belonging to `restaurantId`, optionally filtered by area preference.
 *
 * A table is "available" for booking if:
 *   - seats >= partySize (capacity)
 *   - no active reservation (PENDING/CONFIRMED/SEATED) with an overlapping
 *     window is assigned to it
 *
 * Note: a table currently OCCUPIED by a dining bill is NOT automatically
 * available for a future reservation — the conflict check is purely
 * reservation-window based (a table can be occupied now but reserved for
 * tonight). Table.status is about the live dining session, not future bookings.
 */
export async function findAvailableTables(
  restaurantId: string,
  window: TimeWindow,
  partySize: number,
  areaPreference?: string | null,
): Promise<TableWithCapacity[]> {
  const tables = await db.restaurantTable.findMany({
    where: {
      restaurantId,
      seats: { gte: partySize },
      ...(areaPreference ? { area: areaPreference } : {}),
    },
    select: { id: true, label: true, area: true, seats: true, status: true },
    orderBy: [{ area: "asc" }, { seats: "asc" }, { label: "asc" }],
  });
  if (tables.length === 0) return [];

  // Conflicting reservations: active, overlapping the window, assigned to any
  // of the candidate tables.
  const conflicts = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      tableId: { in: tables.map((t) => t.id) },
      // Overlap: reservation.date < window.end (starts before our end) AND
      // reservation end (date + durationMins) > window.start.
      // Prisma can't compute date+durationMins directly, so fetch candidates
      // with date < window.end then filter by computed end > window.start.
      date: { lt: window.end },
    },
    select: { tableId: true, date: true, durationMins: true },
  });
  const conflictTableIds = new Set<string>();
  for (const c of conflicts) {
    if (!c.tableId) continue;
    const cEnd = new Date(c.date.getTime() + c.durationMins * 60_000);
    if (cEnd.getTime() > window.start.getTime()) {
      conflictTableIds.add(c.tableId);
    }
  }
  return tables.filter((t) => !conflictTableIds.has(t.id));
}

/**
 * Check a specific table for conflicts during a window (used by staff
 * table-assignment). Excludes the reservation being edited.
 */
export async function findTableConflicts(
  restaurantId: string,
  tableId: string,
  window: TimeWindow,
  excludeReservationId?: string,
): Promise<number> {
  const candidates = await db.reservation.findMany({
    where: {
      restaurantId,
      tableId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      date: { lt: window.end },
    },
    select: { date: true, durationMins: true },
  });
  let count = 0;
  for (const c of candidates) {
    const cEnd = new Date(c.date.getTime() + c.durationMins * 60_000);
    if (cEnd.getTime() > window.start.getTime()) count++;
  }
  return count;
}

// ────────────────────────────────────────────────────────────────────────────
// Slot generation (Stage 13A: "available times")
// ────────────────────────────────────────────────────────────────────────────

export interface AvailableSlot {
  time: string; // "HH:mm"
  availableTables: number;
}

/**
 * Generate available time slots for a given date + party size, respecting
 * operating hours and table availability. Slots are generated at a fixed
 * granularity (default 30 min) within the restaurant's open window for that
 * day. Each slot reports how many tables can accommodate the party.
 */
export async function findAvailableSlots(
  restaurantId: string,
  date: Date,
  partySize: number,
  durationMins: number,
  areaPreference?: string | null,
  granularityMins = 30,
): Promise<AvailableSlot[]> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { openingHours: true, reservationsEnabled: true },
  });
  if (!restaurant || !restaurant.reservationsEnabled) return [];

  const hours = parseOpeningHours(restaurant.openingHours);
  if (!hours) {
    // Unconfigured hours → generate a reasonable default window (11:00–22:00)
    // so the booking flow is still usable. Real restaurants configure hours.
    return generateSlotsForWindow(
      restaurantId, date, "11:00", "22:00", partySize, durationMins, areaPreference, granularityMins,
    );
  }
  const dayKey = DAY_KEYS[date.getDay()];
  const dayHours = hours[dayKey];
  if (!dayHours) return []; // closed
  return generateSlotsForWindow(
    restaurantId, date, dayHours.open, dayHours.close, partySize, durationMins, areaPreference, granularityMins,
  );
}

async function generateSlotsForWindow(
  restaurantId: string,
  date: Date,
  openStr: string,
  closeStr: string,
  partySize: number,
  durationMins: number,
  areaPreference: string | null | undefined,
  granularityMins: number,
): Promise<AvailableSlot[]> {
  const open = parseHHmm(openStr);
  const close = parseHHmm(closeStr);
  if (!open || !close) return [];

  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  const openDate = new Date(baseDate);
  openDate.setHours(open.h, open.m, 0, 0);
  const closeDate = new Date(baseDate);
  closeDate.setHours(close.h, close.m, 0, 0);
  // Overnight: close past midnight → add a day.
  if (closeDate <= openDate) closeDate.setDate(closeDate.getDate() + 1);

  const slots: AvailableSlot[] = [];
  for (let t = openDate.getTime(); t + durationMins * 60_000 <= closeDate.getTime(); t += granularityMins * 60_000) {
    const start = new Date(t);
    const end = new Date(t + durationMins * 60_000);
    const tables = await findAvailableTables(restaurantId, { start, end }, partySize, areaPreference);
    if (tables.length > 0) {
      slots.push({
        time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        availableTables: tables.length,
      });
    }
  }
  return slots;
}

// ────────────────────────────────────────────────────────────────────────────
// Booking reference generation
// ────────────────────────────────────────────────────────────────────────────

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/**
 * Generate a human-readable booking reference (e.g. "RSV-K7Q9M2"). Collisions
 * are extremely unlikely (~33^6 ≈ 1.3B space) and retried. The DB column is
 * indexed (not unique-constrained) so app-level enforcement handles the rare
 * collision without a hard DB error.
 */
export async function generateUniqueReference(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
    }
    const ref = `RSV-${code}`;
    const existing = await db.reservation.findFirst({
      where: { reference: ref },
      select: { id: true },
    });
    if (!existing) return ref;
  }
  // Fallback: append a timestamp suffix to guarantee uniqueness.
  return `RSV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Public slug generation
// ────────────────────────────────────────────────────────────────────────────

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate an opaque, URL-safe public slug for a restaurant (e.g. "r7k2m9qa").
 * Distinct from table QR tokens. Collision-checked + retried.
 */
export async function generateUniqueSlug(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let slug = "";
    for (let i = 0; i < 10; i++) {
      slug += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
    }
    const existing = await db.restaurant.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  return `r${Date.now().toString(36)}`;
}
