import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { StaffRole, PlatformRole } from "@prisma/client";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

/**
 * Role privilege ordering within a restaurant.
 * OWNER > MANAGER > CASHIER > SERVER.
 * Used by requireStaffRole to enforce minimum-role checks.
 */
const ROLE_LEVEL: Record<StaffRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  CASHIER: 2,
  SERVER: 1,
};

export interface StaffContext {
  userId: string;
  email: string;
  platformRole: PlatformRole;
  restaurantId: string;
  restaurantName: string;
  role: StaffRole;
}

export type StaffAuthResult =
  | { ok: true; ctx: StaffContext }
  | { ok: false; response: NextResponse };

export type PlatformAdminResult =
  | { ok: true; ctx: { userId: string; email: string; role: PlatformRole } }
  | { ok: false; response: NextResponse };

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

/**
 * The single enforcement point for every tenant-scoped API route.
 *
 * It:
 *   1. Confirms the user is signed in (401 if not).
 *   2. Confirms the user has an active restaurant in the JWT (403 if not).
 *   3. RE-VALIDATES membership against the database — the JWT may be stale if
 *      a membership was revoked or the restaurant was suspended after sign-in.
 *      This is defense in depth; we never trust the token alone for authz.
 *   4. Checks the user's role meets the minimum required for the action.
 *
 * Returns a discriminated result so callers write:
 *   const auth = await requireStaffRole("SERVER");
 *   if (!auth.ok) return auth.response;
 *   // ... use auth.ctx.restaurantId in every Prisma where clause
 */
export async function requireStaffRole(
  minRole: StaffRole,
): Promise<StaffAuthResult> {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      ),
    };
  }

  const restaurantId = session.user.activeRestaurantId;
  if (!restaurantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "no_restaurant_assigned" },
        { status: 403 },
      ),
    };
  }

  const membership = await db.restaurantStaff.findUnique({
    where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
    include: { restaurant: { select: { name: true, status: true } } },
  });
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "membership_revoked" },
        { status: 403 },
      ),
    };
  }
  if (membership.restaurant.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "restaurant_inactive" },
        { status: 403 },
      ),
    };
  }
  if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[minRole]) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "insufficient_role", required: minRole },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      userId: session.user.id,
      email: session.user.email ?? "",
      platformRole: session.user.platformRole,
      restaurantId,
      restaurantName: membership.restaurant.name,
      role: membership.role,
    },
  };
}

/**
 * Enforces ROHI platform-level admin access (for the ROHI administration
 * console, restaurant onboarding, etc.). Distinct from restaurant staff auth.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminResult> {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      ),
    };
  }
  const role = session.user.platformRole;
  if (role !== "ADMIN" && role !== "SUPPORT") {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return {
    ok: true,
    ctx: { userId: session.user.id, email: session.user.email ?? "", role },
  };
}
