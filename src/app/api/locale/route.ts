import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  locale: z.enum(["pt", "en"]),
});

// POST /api/locale — sets the NEXT_LOCALE cookie used by next-intl's
// non-routed request config. Called by the language toggle on the guest page.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale: parsed.data.locale });
  res.cookies.set("NEXT_LOCALE", parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
