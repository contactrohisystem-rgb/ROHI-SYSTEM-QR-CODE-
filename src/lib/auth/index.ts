import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

/**
 * NextAuth configuration for ROHI.
 *
 * Strategy decisions:
 * - JWT session (not database sessions): works cleanly with the App Router,
 *   avoids a DB lookup on every request, and lets us carry tenant context
 *   (platformRole, activeRestaurantId, activeRole) inside the token.
 * - Credentials provider: restaurant staff sign in with email + password.
 *   User records are managed by ROHI admin tooling (onboarding), not open
 *   self-signup, so there is no public registration endpoint in the MVP.
 * - No PrismaAdapter: with credentials + JWT the adapter is unused for the
 *   credentials flow. The Account/Session/VerificationToken models remain in
 *   the schema for future OAuth providers but are not actively written yet.
 */
export const authOptions: NextAuthOptions = {
  // Trust the request's Host header. Required when running behind a reverse
  // proxy / gateway (the preview panel proxies localhost:3000 through an
  // HTTPS gateway). Without this, NextAuth may not recognise the gateway's
  // host and the session cookie/callback won't work for preview users.
  trustHost: true,
  // Production security: NEXTAUTH_SECRET should be set via env var. A
  // hardcoded fallback is visible in source and allows JWT forgery. In
  // production, the instrumentation hook logs a FATAL warning if it's missing.
  // We don't throw at module-load time (that would break `next build` which
  // runs with NODE_ENV=production). The check is at server startup instead.
  secret:
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? "INSECURE_PRODUCTION_NO_SECRET_SET"
      : "f1e5d492c96bb1f7fb546b8fc07f47653ddb285b00cc5a9da39cf1fc261c8787"),
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.userId;
      if (!userId) return token;
      // On sign-in, set the immutable identity fields.
      if (user?.id) {
        token.userId = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { platformRole: true },
        });
        token.platformRole = dbUser?.platformRole ?? "NONE";
      }
      // Active restaurant: read the switch cookie (set by the switcher) and
      // validate the user's membership; fall back to the first active
      // membership. This runs on every request so switching is instant.
      const cookieStore = await cookies();
      const switchId = cookieStore.get("ROHI_ACTIVE_REST")?.value;
      const memberships = await db.restaurantStaff.findMany({
        where: { userId },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              status: true,
              brandPrimary: true,
              brandSecondary: true,
              brandAccent: true,
              logoUrl: true,
              appearance: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      const activeM = switchId
        ? memberships.find(
            (m) => m.restaurantId === switchId && m.restaurant.status === "active",
          )
        : null;
      const chosen =
        activeM ?? memberships.find((m) => m.restaurant.status === "active");
      if (chosen) {
        token.activeRestaurantId = chosen.restaurantId;
        token.activeRestaurantName = chosen.restaurant.name;
        token.activeRole = chosen.role;
        token.activeBrand = {
          primary: chosen.restaurant.brandPrimary ?? undefined,
          secondary: chosen.restaurant.brandSecondary ?? undefined,
          accent: chosen.restaurant.brandAccent ?? undefined,
          logoUrl: chosen.restaurant.logoUrl ?? undefined,
          appearance: chosen.restaurant.appearance ?? "dark",
        };
      }
      token.memberships = memberships.map((m) => ({
        id: m.restaurantId,
        name: m.restaurant.name,
        role: m.role,
      }));
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.platformRole = token.platformRole ?? "NONE";
        session.user.activeRestaurantId = token.activeRestaurantId;
        session.user.activeRestaurantName = token.activeRestaurantName;
        session.user.activeRole = token.activeRole;
        session.user.activeBrand = token.activeBrand;
        session.user.memberships = token.memberships;
      }
      return session;
    },
  },
};
