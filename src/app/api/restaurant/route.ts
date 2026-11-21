import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";

const HEX = /^#[0-9a-fA-F]{6}$/;

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  brandPrimary: z.string().regex(HEX).nullable().optional(),
  brandSecondary: z.string().regex(HEX).nullable().optional(),
  brandAccent: z.string().regex(HEX).nullable().optional(),
  appearance: z.enum(["dark", "light"]).optional(),
  // Stage 13G: reservation policy fields.
  description: z.string().max(1000).nullable().optional(),
  reservationsEnabled: z.boolean().optional(),
  openingHours: z.string().max(2000).nullable().optional(),
  defaultReservationDurationMins: z.number().int().min(30).max(240).optional(),
  minNoticeMins: z.number().int().min(0).max(10080).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
  maxPartySize: z.number().int().min(1).max(50).optional(),
  reservationApprovalMode: z.enum(["STAFF", "AUTO"]).optional(),
  reservationCancellationPolicy: z.string().max(500).nullable().optional(),
  // Payment method config (per-restaurant enable/disable).
  cashEnabled: z.boolean().optional(),
  codEnabled: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
  mpesaEnabled: z.boolean().optional(),
  emolaEnabled: z.boolean().optional(),
  deliveryFeeMinor: z.number().int().min(0).optional(),
  minCodOrderMinor: z.number().int().min(0).optional(),
  maxCodOrderMinor: z.number().int().min(0).optional(),
  deliveryZones: z.string().max(2000).nullable().optional(),
});

// GET /api/restaurant — the active restaurant's profile + branding + reservation
// policy (MANAGER+).
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.ctx.restaurantId },
    select: {
      id: true,
      name: true,
      legalName: true,
      phone: true,
      address: true,
      currency: true,
      locale: true,
      logoUrl: true,
      coverUrl: true,
      brandPrimary: true,
      brandSecondary: true,
      brandAccent: true,
      appearance: true,
      slug: true,
      description: true,
      reservationsEnabled: true,
      openingHours: true,
      defaultReservationDurationMins: true,
      minNoticeMins: true,
      maxAdvanceDays: true,
      maxPartySize: true,
      reservationApprovalMode: true,
      reservationCancellationPolicy: true,
      cashEnabled: true,
      codEnabled: true,
      cardEnabled: true,
      mpesaEnabled: true,
      emolaEnabled: true,
      deliveryFeeMinor: true,
      minCodOrderMinor: true,
      maxCodOrderMinor: true,
      deliveryZones: true,
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ restaurant });
}

// PATCH /api/restaurant — update the restaurant profile + branding (MANAGER+).
// All fields optional; only provided fields are updated.
export async function PATCH(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const restaurant = await db.restaurant.update({
    where: { id: auth.ctx.restaurantId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      brandPrimary: true,
      brandSecondary: true,
      brandAccent: true,
      logoUrl: true,
      appearance: true,
    },
  });
  return NextResponse.json({ restaurant });
}
