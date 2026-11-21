import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brandCssVars } from "@/lib/brand";
import { BookingFlow } from "@/components/public/booking-flow";
import { ReservationStatusLookup } from "@/components/public/reservation-status-lookup";
import { LangToggle } from "@/components/lang-toggle";
import { CalendarCheck, MapPin, Phone, Store } from "lucide-react";

export const metadata = { title: "ROHI — Reservar" };

/**
 * Public restaurant booking page (Stage 13A/B). Mobile-first, light theme,
 * branded per-restaurant. Distinct from the table-QR payment flow (/pay) — no
 * table token is required to make a reservation.
 *
 * The slug is opaque and tenant-scoped; the backend resolves it to the
 * restaurant. Internal ids are never exposed.
 */
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lookup?: string }>;
}) {
  const { slug } = await params;
  const { lookup } = await searchParams;

  const restaurant = await db.restaurant.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      logoUrl: true,
      coverUrl: true,
      brandPrimary: true,
      brandAccent: true,
      currency: true,
      locale: true,
      openingHours: true,
      reservationsEnabled: true,
      defaultReservationDurationMins: true,
      minNoticeMins: true,
      maxAdvanceDays: true,
      maxPartySize: true,
      reservationApprovalMode: true,
      reservationCancellationPolicy: true,
    },
  });
  if (!restaurant) notFound();

  const areas = await db.area.findMany({
    where: { floorPlan: { restaurantId: restaurant.id } },
    orderBy: { sortOrder: "asc" },
    select: { name: true },
  });

  const brandVars = brandCssVars({
    primary: restaurant.brandPrimary ?? undefined,
    accent: restaurant.brandAccent ?? undefined,
  });

  const showLookup = lookup === "1";

  return (
    <main
      className="theme-light flex min-h-screen flex-col bg-background"
      style={brandVars}
    >
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <span className="text-[10px] font-bold text-primary-foreground">R</span>
              </div>
            )}
            <span className="text-sm font-semibold tracking-tight">{restaurant.name}</span>
          </div>
          <a
            href={`/r/${encodeURIComponent(slug)}${showLookup ? "" : "?lookup=1"}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {showLookup ? "Reservar" : "Ver reserva"}
          </a>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        {/* Restaurant identity / hero */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div
            className="h-28"
            style={
              restaurant.coverUrl
                ? { backgroundImage: `url(${restaurant.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : {
                    background:
                      "linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.42 0.13 160) 60%, oklch(0.32 0.1 165))",
                  }
            }
          />
          <div className="px-4 pb-4">
            <div className="-mt-7 flex items-end justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-card bg-muted shadow-sm overflow-hidden">
                {restaurant.logoUrl ? (
                  <img src={restaurant.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-6 w-6 text-foreground" />
                )}
              </div>
              {restaurant.reservationsEnabled ? (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <CalendarCheck className="h-3 w-3" /> Reservas abertas
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Reservas indisponíveis
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight">{restaurant.name}</h1>
            {restaurant.description && (
              <p className="mt-1 text-sm text-muted-foreground">{restaurant.description}</p>
            )}
            <div className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {restaurant.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {restaurant.address}
                </span>
              )}
              {restaurant.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {restaurant.phone}
                </span>
              )}
            </div>
            {restaurant.reservationApprovalMode === "STAFF" && (
              <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                As reservas são confirmadas pela equipa do restaurante. Receberá a confirmação em breve.
              </p>
            )}
            {restaurant.reservationCancellationPolicy && (
              <p className="mt-2 text-[11px] italic text-muted-foreground">
                {restaurant.reservationCancellationPolicy}
              </p>
            )}
          </div>
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
            areas={areas.map((a) => a.name)}
          />
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
            <p className="text-sm font-medium">Reservas desactivadas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Este restaurante não aceita reservas online neste momento.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto w-full max-w-md px-4 py-3 text-center text-[11px] text-muted-foreground">
          Reservas e pagamento seguro por ROHI
        </div>
      </footer>
    </main>
  );
}
