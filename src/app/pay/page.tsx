import { db } from "@/lib/db";
import {
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { LangToggle } from "@/components/lang-toggle";
import { getActiveBillForTable } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { CheckoutPanel } from "@/components/payments/checkout-panel";
import { brandCssVars } from "@/lib/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, QrCode, Store, Utensils } from "lucide-react";

export const metadata = { title: "ROHI — Pagamento" };

const RECENT_PAID_WINDOW_MS = 30 * 60 * 1000;

/**
 * Guest payment entry point (LIGHT theme, mobile-first).
 *
 * The QR encodes only /pay?table=<opaque token>. The backend resolves token ->
 * table -> restaurant -> active bill server-side. The guest never receives a
 * billId or paymentId they could use without the token.
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const t = await getTranslations("GuestPay");
  const locale = await getLocale();
  const moneyLocale = locale === "en" ? "en" : "pt";
  const messages = await getMessages();
  const { table: token } = await searchParams;

  const table = token
    ? await db.restaurantTable.findUnique({
        where: { token },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              status: true,
              brandPrimary: true,
              brandAccent: true,
              logoUrl: true,
            },
          },
        },
      })
    : null;

  const invalid = !table || table.restaurant.status !== "active";

  const activeBill =
    table && !invalid ? await getActiveBillForTable(table.id) : null;

  let recentPaidBill: {
    id: string;
    totalMinor: number;
    currency: string;
    closedAt: Date;
  } | null = null;
  if (table && !invalid && !activeBill) {
    recentPaidBill = await db.bill.findFirst({
      where: {
        tableId: table.id,
        status: "PAID",
        closedAt: { gte: new Date(Date.now() - RECENT_PAID_WINDOW_MS) },
      },
      orderBy: { closedAt: "desc" },
      select: { id: true, totalMinor: true, currency: true, closedAt: true },
    });
  }

  const brandVars = table
    ? brandCssVars({
        primary: table.restaurant.brandPrimary ?? undefined,
        accent: table.restaurant.brandAccent ?? undefined,
      })
    : {};

  return (
    <main
      className="theme-light flex min-h-screen flex-col bg-background"
      style={brandVars}
    >
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            {table?.restaurant.logoUrl ? (
              <img
                src={table.restaurant.logoUrl}
                alt=""
                className="h-7 w-7 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <span className="text-[10px] font-bold text-primary-foreground">
                  R
                </span>
              </div>
            )}
            <span className="text-sm font-semibold tracking-tight">
              {t("title")}
            </span>
          </div>
          <LangToggle locale={locale as "pt" | "en"} />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4">
        {invalid ? (
          <Card className="mt-6 border-border/60">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <QrCode className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-base font-medium">{t("invalidTitle")}</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {t("invalidDescription")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Restaurant identity */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div
                className="h-20"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.42 0.13 160) 60%, oklch(0.32 0.1 165))",
                }}
              />
              <div className="px-4 pb-4">
                <div className="-mt-6 flex items-end justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-card bg-muted shadow-sm">
                    <Store className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Utensils className="h-3 w-3" />
                    {t("table")} {table!.label}
                  </div>
                </div>
                <h1 className="mt-2 text-lg font-semibold tracking-tight">
                  {table!.restaurant.name}
                </h1>
                {table!.area && (
                  <p className="text-xs text-muted-foreground">{table!.area}</p>
                )}
              </div>
            </div>

            {activeBill ? (
              <>
                {/* Bill */}
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <div className="border-b border-border/60 px-4 py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("bill")}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    {activeBill.items.length === 0 ? (
                      <p className="py-3 text-sm text-muted-foreground">
                        {t("noItems")}
                      </p>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {activeBill.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-start justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium">
                                {it.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {it.quantity} ×{" "}
                                {formatMoney(
                                  it.unitPriceMinor,
                                  activeBill.currency,
                                  moneyLocale,
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium tabular">
                              {formatMoney(
                                it.totalMinor,
                                activeBill.currency,
                                moneyLocale,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeBill.adjustments.length > 0 && (
                      <>
                        <Separator className="my-1 bg-border/60" />
                        <div className="space-y-1 py-1">
                          {activeBill.adjustments.map((a) => (
                            <div
                              key={a.id}
                              className="flex justify-between text-sm"
                            >
                              <span className="text-muted-foreground">
                                {a.label}
                              </span>
                              <span
                                className={
                                  a.amountMinor < 0
                                    ? "tabular text-destructive"
                                    : "tabular"
                                }
                              >
                                {formatMoney(
                                  a.amountMinor,
                                  activeBill.currency,
                                  moneyLocale,
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <Separator className="my-2 bg-border/60" />
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("subtotal")}
                        </span>
                        <span className="tabular">
                          {formatMoney(
                            activeBill.subtotalMinor,
                            activeBill.currency,
                            moneyLocale,
                          )}
                        </span>
                      </div>
                      {activeBill.adjustmentTotalMinor !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("adjustments")}
                          </span>
                          <span className="tabular">
                            {formatMoney(
                              activeBill.adjustmentTotalMinor,
                              activeBill.currency,
                              moneyLocale,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 text-lg font-semibold">
                        <span>{t("total")}</span>
                        <span className="tabular">
                          {formatMoney(
                            activeBill.totalMinor,
                            activeBill.currency,
                            moneyLocale,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout */}
                <NextIntlClientProvider locale={locale} messages={messages}>
                  <CheckoutPanel
                    tableToken={token!}
                    bill={{
                      id: activeBill.id,
                      totalMinor: activeBill.totalMinor,
                      currency: activeBill.currency,
                    }}
                    locale={moneyLocale as "pt" | "en"}
                  />
                </NextIntlClientProvider>
              </>
            ) : recentPaidBill ? (
              <Card className="mt-4 border-border/60">
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-base font-semibold">{t("success")}</p>
                  <div className="w-full rounded-xl bg-muted/50 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("paidAmount")}
                      </span>
                      <span className="font-semibold tabular">
                        {formatMoney(
                          recentPaidBill.totalMinor,
                          recentPaidBill.currency,
                          moneyLocale,
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="max-w-xs text-[11px] text-muted-foreground">
                    {t("successNote")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="mt-4 border-border/60">
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <QrCode className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-base font-medium">
                    {t("noActiveBill")}
                  </p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {t("noActiveBillDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto w-full max-w-md px-4 py-3 text-center text-[11px] text-muted-foreground">
          {t("poweredBy")}
        </div>
      </footer>
    </main>
  );
}
