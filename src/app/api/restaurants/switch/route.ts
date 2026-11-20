import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";

const schema = z.object({ restaurantId: z.string().min(1) });

/**
 * POST /api/restaurants/switch — switch the caller's active restaurant.
 *
 * Validates that the signed-in user has an active membership at the target
 * restaurant, then sets a ROHI_ACTIVE_REST cookie. The NextAuth JWT callback
 * reads this cookie on the next request, so the switch is instant (no
 * re-sign-in). The user must already be authenticated (any staff role at
 * their CURRENT restaurant); membership at the TARGET is validated separately.
 */
export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const membership = await db.restaurantStaff.findFirst({
    where: { userId: session.user.id, restaurantId: parsed.data.restaurantId },
    include: { restaurant: { select: { status: true } } },
  });
  if (!membership || membership.restaurant.status !== "active") {
    return NextResponse.json({ error: "not_a_member" }, { status: 403 });
  }

  const res = NextResponse.json({
    ok: true,
    restaurantId: parsed.data.restaurantId,
  });
  res.cookies.set("ROHI_ACTIVE_REST", parsed.data.restaurantId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
