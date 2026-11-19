import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
      // On initial sign-in, `user` is populated. Enrich the token with the
      // tenant context we need for authorization on every subsequent request.
      if (user?.id) {
        token.userId = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            platformRole: true,
            memberships: {
              include: {
                restaurant: { select: { id: true, name: true, status: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        if (dbUser) {
          token.platformRole = dbUser.platformRole;
          // Default active restaurant = first active membership. Multi-restaurant
          // users will get a switcher in a later task.
          const firstActive = dbUser.memberships.find(
            (m) => m.restaurant.status === "active",
          );
          if (firstActive) {
            token.activeRestaurantId = firstActive.restaurantId;
            token.activeRestaurantName = firstActive.restaurant.name;
            token.activeRole = firstActive.role;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.platformRole = token.platformRole ?? "NONE";
        session.user.activeRestaurantId = token.activeRestaurantId;
        session.user.activeRestaurantName = token.activeRestaurantName;
        session.user.activeRole = token.activeRole;
      }
      return session;
    },
  },
};
