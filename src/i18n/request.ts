import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Static imports (not dynamic template-literal imports) because Next.js 16's
// Turbopack dev compiler cannot resolve fully-dynamic paths like
// `../messages/${locale}.json`. With only two locales, static imports are
// simple, fast, and reliable. Using the @/ alias (maps to ./src/*) avoids
// relative-path confusion from the i18n/ subdirectory.
import ptMessages from "@/messages/pt.json";
import enMessages from "@/messages/en.json";

export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

/**
 * next-intl request config (non-routed mode).
 *
 * Locale resolution:
 *   1. NEXT_LOCALE cookie (set by the language toggle on the guest page).
 *   2. Defaults to "pt" (Portuguese) — the primary market is Mozambique.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = raw === "en" ? "en" : "pt";
  return {
    locale,
    messages: locale === "en" ? enMessages : ptMessages,
  };
});
