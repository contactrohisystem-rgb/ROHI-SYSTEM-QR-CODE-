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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, QrCode, Store, Utensils } from "lucide-react";

export const metadata = { title: "ROHI — Pagamento" };

// A bill is considered "recently paid" (and shown as a confirmation card on
// reload) if it was paid within this window. Lets the guest see a success
// state if they refresh right after paying.
const RECENT_PAID_WINDOW_MS = 30 * 60 * 1000;

/**
 * Guest payment entry point.
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
          restaurant: { select: { id: true, name: true, status: true } },
        },
      })
    : null;

  const invalid = !table || table.restaurant.status !== "active";

  // Active (OPEN) bill for the table.
  const activeBill =
    table && !invalid ? await getActiveBillForTable(table.id) : null;

  // If no active bill, look for a recently-PAID bill so a post-payment reload
  // shows a confirmation instead of an abrupt "no active bill".
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

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4 p-4">
          <span className="text-lg font-semibold tracking-tight">
            {t("title")}
          </span>
          <LangToggle locale={locale as "pt" | "en"} />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        {invalid ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">{t("invalidTitle")}</CardTitle>
              <CardDescription>{t("invalidDescription")}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Restaurant + table identification */}
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Store className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">
                    {t("restaurant")}
                  </span>
                </div>
                <CardTitle className="text-xl">
                  {table!.restaurant.name}
                </CardTitle>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Utensils className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">
                    {t("table")}
                  </span>
                </div>
                <div className="text-lg font-medium">{table!.label}</div>
                {table!.area && (
                  <div className="text-sm text-muted-foreground">
                    {table!.area}
                  </div>
                )}
              </CardHeader>
            </Card>

            {activeBill ? (
              <>
                {/* Read-only bill breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("bill")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeBill.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("noItems")}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeBill.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-start justify-between gap-2 text-sm"
                          >
                            <div className="min-w-0">
                              <span className="font-medium">{it.name}</span>
                              <span className="ml-1 text-muted-foreground">
                                {it.quantity} ×{" "}
                                {formatMoney(
                                  it.unitPriceMinor,
                                  activeBill.currency,
                                  moneyLocale,
                                )}
                              </span>
                            </div>
                            <span className="font-medium">
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
                        <Separator />
                        <div className="space-y-1">
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
                                  a.amountMinor < 0 ? "text-destructive" : ""
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

                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t("subtotal")}
                        </span>
                        <span>
                          {formatMoney(
                            activeBill.subtotalMinor,
                            activeBill.currency,
                            moneyLocale,
                          )}
                        </span>
                      </div>
                      {activeBill.adjustmentTotalMinor !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t("adjustments")}
                          </span>
                          <span>
                            {formatMoney(
                              activeBill.adjustmentTotalMinor,
                              activeBill.currency,
                              moneyLocale,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-semibold">
                        <span>{t("total")}</span>
                        <span>
                          {formatMoney(
                            activeBill.totalMinor,
                            activeBill.currency,
                            moneyLocale,
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Interactive checkout (client) */}
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
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <p className="text-base font-semibold">{t("success")}</p>
                  <div className="w-full rounded-md border bg-muted/40 px-3 py-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("paidAmount")}
                      </span>
                      <span className="font-semibold">
                        {formatMoney(
                          recentPaidBill.totalMinor,
                          recentPaidBill.currency,
                          moneyLocale,
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    {t("successNote")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex-1">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <QrCode className="h-10 w-10 text-muted-foreground" />
                  <p className="text-base font-medium">{t("noActiveBill")}</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {t("noActiveBillDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-md p-4 text-center text-xs text-muted-foreground">
          {t("poweredBy")}
        </div>
      </footer>
    </main>
  );
}
