import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v4 App Router route handler.
// Handles /api/auth/* (sign in, sign out, session, csrf, etc.).
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
