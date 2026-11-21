import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brandCssVars } from "@/lib/brand";
import { MareaMenu } from "@/components/public/marea-menu";
import { BookingFlow } from "@/components/public/booking-flow";
import { ReservationStatusLookup } from "@/components/public/reservation-status-lookup";
import { LangToggle } from "@/components/lang-toggle";
import { CalendarCheck, ChevronDown, Clock, MapPin, Phone, Sparkles } from "lucide-react";

export const metadata = { title: "MARÉA — Coastal Dining, Maputo" };

const SERIF = "var(--font-playfair), Georgia, 'Times New Roman', serif";

/**
 * MARÉA public digital restaurant (Stage: MARÉA prototype).
 *
 * A full premium restaurant experience: hero, story, digital menu with
 * pre-order, reservations, and footer. Mobile-first, editorial typography,
 * forest-green / ivory / gold palette. Distinct from the table-QR payment
 * flow (/pay) — no table token required.
 */
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lookup?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { lookup, lang } = await searchParams;
  const locale = lang === "en" ? "en" : "pt";
  const showLookup = lookup === "1";

  const restaurant = await db.restaurant.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      coverUrl: true,
      brandPrimary: true,
      brandAccent: true,
      currency: true,
      openingHours: true,
      reservationsEnabled: true,
      defaultReservationDurationMins: true,
      maxPartySize: true,
      reservationApprovalMode: true,
      reservationCancellationPolicy: true,
    },
  });
  if (!restaurant) notFound();

  const brandVars = brandCssVars({
    primary: restaurant.brandPrimary ?? undefined,
    accent: restaurant.brandAccent ?? undefined,
  });

  // Parse opening hours for the footer.
  let hoursEntries: { day: string; open: string; close: string }[] | null = null;
  if (restaurant.openingHours) {
    try {
      const parsed = JSON.parse(restaurant.openingHours);
      const dayLabels: Record<string, string> = {
        mon: "Segunda", tue: "Terça", wed: "Quarta", thu: "Quinta", fri: "Sexta", sat: "Sábado", sun: "Domingo",
      };
      hoursEntries = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        .map((k) => {
          const v = parsed[k];
          return v ? { day: dayLabels[k], open: v.open, close: v.close } : null;
        })
        .filter((x): x is { day: string; open: string; close: string } => !!x);
    } catch { /* malformed → skip */ }
  }

  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);

  return (
    <main className="theme-light min-h-screen bg-[#F7F3EA]" style={brandVars}>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden text-center text-white">
        <div className="absolute inset-0">
          <img
            src={restaurant.coverUrl ?? "/marea-hero.png"}
            alt="MARÉA coastal dining"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,43,37,0.55) 0%, rgba(16,43,37,0.45) 40%, rgba(16,43,37,0.75) 100%)" }} />
        </div>

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-5">
          <span className="text-sm font-medium tracking-[0.3em] uppercase" style={{ color: "#C6A66B" }}>
            MARÉA
          </span>
          <div className="flex items-center gap-3">
            <a href="#menu" className="hidden text-xs font-medium tracking-wide text-white/80 hover:text-white sm:block">
              {t("Menu", "Menu")}
            </a>
            <a href="#reservations" className="hidden text-xs font-medium tracking-wide text-white/80 hover:text-white sm:block">
              {t("Reservas", "Reservations")}
            </a>
            <a href="#story" className="hidden text-xs font-medium tracking-wide text-white/80 hover:text-white sm:block">
              {t("História", "Story")}
            </a>
            <LangToggle locale={locale} />
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-2xl px-6">
          <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase" style={{ color: "#C6A66B" }}>
            {t("Coastal Dining · Maputo", "Coastal Dining · Maputo")}
          </p>
          <h1 className="text-6xl font-medium leading-none sm:text-7xl md:text-8xl" style={{ fontFamily: SERIF }}>
            MARÉA
          </h1>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-white/85 sm:text-xl" style={{ fontFamily: SERIF, fontStyle: "italic" }}>
            {t("O Índico, servido de outra forma.", "The Indian Ocean, served differently.")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#menu"
              className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-medium tracking-wide text-[#173C32] shadow-lg transition-transform hover:scale-[1.02]"
              style={{ background: "#C6A66B" }}
            >
              {t("Explorar Menu", "Explore Menu")}
            </a>
            <a
              href="#reservations"
              className="inline-flex items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              {t("Reservar Mesa", "Reserve Your Table")}
            </a>
          </div>
        </div>

        {/* Scroll cue */}
        <a href="#story" className="absolute bottom-6 z-10 flex flex-col items-center gap-1 text-white/60">
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </section>

      {/* ── Story ── */}
      <section id="story" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Sparkles className="mx-auto mb-4 h-5 w-5" style={{ color: "#C6A66B" }} />
        <h2 className="text-3xl font-medium leading-tight sm:text-4xl" style={{ fontFamily: SERIF, color: "#173C32" }}>
          {t("Onde o oceano encontra a mesa", "Where the ocean meets the table")}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#173C32]/70">
          {restaurant.description ??
            (locale === "pt"
              ? "MARÉA é um restaurante fictício que combina os sabores de Moçambique com a cozinha internacional contemporânea."
              : "MARÉA is a fictional restaurant combining the flavours of Mozambique with contemporary international cuisine.")}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm italic text-[#173C32]/50">
          {t(
            "Experiência de protótipo — preços e pratos são demonstrativos.",
            "Prototype experience — prices and dishes are for demonstration.",
          )}
        </p>
      </section>

      {/* ── Menu ── */}
      <section id="menu" className="bg-[#F7F3EA] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-medium tracking-[0.3em] uppercase" style={{ color: "#C6A66B" }}>
              {t("Carta", "Menu")}
            </p>
            <h2 className="text-4xl font-medium sm:text-5xl" style={{ fontFamily: SERIF, color: "#173C32" }}>
              {t("A Nossa Cozinha", "Our Kitchen")}
            </h2>
          </div>
          <MareaMenu slug={slug} currency={restaurant.currency} locale={locale} />
        </div>
      </section>

      {/* ── Reservations ── */}
      <section id="reservations" className="px-6 py-20" style={{ background: "#173C32" }}>
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-medium tracking-[0.3em] uppercase" style={{ color: "#C6A66B" }}>
              {t("Reservas", "Reservations")}
            </p>
            <h2 className="text-4xl font-medium text-white sm:text-5xl" style={{ fontFamily: SERIF }}>
              {t("Reserve a sua mesa", "Reserve your table")}
            </h2>
          </div>
          {showLookup ? (
            <ReservationStatusLookup slug={slug} />
          ) : restaurant.reservationsEnabled ? (
            <BookingFlow
              slug={slug}
              restaurant={{
                defaultReservationDurationMins: restaurant.defaultReservationDurationMins,
                maxPartySize: restaurant.maxPartySize,
                approvalMode: restaurant.reservationApprovalMode,
              }}
              areas={[]}
            />
          ) : (
            <div className="rounded-2xl bg-white/5 p-6 text-center text-white/70">
              <p className="text-sm">{t("Reservas desactivadas.", "Reservations are disabled.")}</p>
            </div>
          )}
          <div className="mt-6 text-center">
            <a
              href={`/r/${encodeURIComponent(slug)}${showLookup ? "" : "?lookup=1"}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide"
              style={{ color: "#C6A66B" }}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {showLookup ? t("Fazer reserva", "Make a reservation") : t("Ver a minha reserva", "Check my reservation")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#102B25] px-6 py-12 text-white/70">
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-3 text-lg font-medium text-white" style={{ fontFamily: SERIF }}>MARÉA</h3>
              <p className="text-sm leading-relaxed">
                {t("Coastal Dining · Maputo", "Coastal Dining · Maputo")}
              </p>
              <p className="mt-1 text-xs italic" style={{ color: "#C6A66B" }}>
                {t("O Índico, servido de outra forma.", "The Indian Ocean, served differently.")}
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#C6A66B" }}>
                {t("Contacto", "Contact")}
              </h4>
              {restaurant.address && (
                <p className="mb-2 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {restaurant.address}
                </p>
              )}
              {restaurant.phone && (
                <p className="mb-2 flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5" /> {restaurant.phone}
                </p>
              )}
            </div>
            <div>
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#C6A66B" }}>
                {t("Horário", "Hours")}
              </h4>
              {hoursEntries && hoursEntries.length > 0 ? (
                <div className="space-y-1">
                  {hoursEntries.map((h) => (
                    <p key={h.day} className="flex items-center justify-between text-xs">
                      <span>{h.day}</span>
                      <span className="tabular text-white/50">{h.open}–{h.close}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5" /> {t("Consulte a recepção", "Contact reception")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 text-center text-[11px] text-white/40">
            <p>MARÉA — {t("restaurante fictício de demonstração.", "fictional demonstration restaurant.")}</p>
            <p className="mt-1">Technology by ROHI</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
