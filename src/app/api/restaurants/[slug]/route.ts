import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/restaurants/[slug] — public restaurant profile for the booking page.
 *
 * No auth required. Returns only public, non-sensitive fields. Never returns
 * staff, internal ids beyond the slug, POS config, audit data, or table tokens.
 * Resolves the tenant from the opaque slug (never from a client-supplied id).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const restaurant = await db.restaurant.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      logoUrl: true,
      coverUrl: true,
      brandPrimary: true,
      brandSecondary: true,
      brandAccent: true,
      currency: true,
      locale: true,
      openingHours: true,
      reservationsEnabled: true,
      defaultReservationDurationMins: true,
      minNoticeMins: true,
      maxAdvanceDays: true,
      maxPartySize: true,
      reservationApprovalMode: true,
      reservationCancellationPolicy: true,
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Distinct seating areas (from the floor-plan areas) for the preference dropdown.
  const areas = await db.area.findMany({
    where: { floorPlan: { restaurantId: restaurant.id } },
    orderBy: { sortOrder: "asc" },
    select: { name: true },
  });

  return NextResponse.json({
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      logoUrl: restaurant.logoUrl,
      coverUrl: restaurant.coverUrl,
      brandPrimary: restaurant.brandPrimary,
      brandSecondary: restaurant.brandSecondary,
      brandAccent: restaurant.brandAccent,
      currency: restaurant.currency,
      locale: restaurant.locale,
      openingHours: restaurant.openingHours,
      reservationsEnabled: restaurant.reservationsEnabled,
      defaultReservationDurationMins: restaurant.defaultReservationDurationMins,
      minNoticeMins: restaurant.minNoticeMins,
      maxAdvanceDays: restaurant.maxAdvanceDays,
      maxPartySize: restaurant.maxPartySize,
      reservationApprovalMode: restaurant.reservationApprovalMode,
      reservationCancellationPolicy: restaurant.reservationCancellationPolicy,
    },
    areas: areas.map((a) => a.name),
  });
}
