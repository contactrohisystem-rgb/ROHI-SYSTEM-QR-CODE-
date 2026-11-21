import type { StaffRole, PlatformRole } from "@prisma/client";

export interface RestaurantBrand {
  primary?: string;
  secondary?: string;
  accent?: string;
  logoUrl?: string;
  appearance?: string; // "dark" | "light"
}

export interface MembershipView {
  id: string;
  name: string;
  role: StaffRole;
}

/**
 * NextAuth type augmentation.
 * Extends the Session and JWT with ROHI tenant context so server and client
 * code can read the active restaurant, roles, brand, and memberships.
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
      activeBrand?: RestaurantBrand;
      memberships?: MembershipView[];
    };
  }
  // trustHost is a valid NextAuth v4 runtime option (used behind reverse
  // proxies / gateways) but is missing from the installed version's AuthOptions
  // type. Augment it here rather than casting, so the rest of the config stays
  // fully type-checked.
  interface AuthOptions {
    trustHost?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    platformRole?: PlatformRole;
    activeRestaurantId?: string;
    activeRestaurantName?: string;
    activeRole?: StaffRole;
    activeBrand?: RestaurantBrand;
    memberships?: MembershipView[];
  }
}
