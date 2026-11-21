import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * POST /api/reservations — guest submits a reservation request (token-gated).
 * Creates a PENDING reservation. Staff confirm/reject via the dashboard.
 */
const schema = z.object({
  tableToken: z.string().min(1),
  customerName: z.string().min(1).max(80),
  phone: z.string().min(5).max(30),
  partySize: z.number().int().min(1).max(20),
  date: z.string(), // ISO datetime
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

  const reservation = await db.reservation.create({
    data: {
      restaurantId: table.restaurant.id,
      customerName: data.customerName,
      phone: data.phone,
      partySize: data.partySize,
      date: new Date(data.date),
      areaPreference: data.areaPreference ?? null,
      notes: data.notes ?? null,
      status: "PENDING",
    },
  });

  return NextResponse.json({ reservation }, { status: 201 });
}

/**
 * GET /api/reservations — staff lists reservations (MANAGER+).
 */
export async function GET() {
  const { requireStaffRole } = await import("@/lib/auth/session");
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;

  const reservations = await db.reservation.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { date: "asc" },
    take: 50,
    include: { table: { select: { label: true } } },
  });

  return NextResponse.json({ reservations });
}
