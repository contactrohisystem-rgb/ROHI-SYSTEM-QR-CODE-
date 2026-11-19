import type { StaffRole, PlatformRole } from "@prisma/client";

/**
 * NextAuth type augmentation.
 * Extends the Session and JWT with ROHI tenant context so server and client
 * code can read the active restaurant + roles from the session directly.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      platformRole: PlatformRole;
      activeRestaurantId?: string;
      activeRestaurantName?: string;
      activeRole?: StaffRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    platformRole?: PlatformRole;
    activeRestaurantId?: string;
    activeRestaurantName?: string;
    activeRole?: StaffRole;
  }
}
