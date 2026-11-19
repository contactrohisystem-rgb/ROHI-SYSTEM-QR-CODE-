import { db } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { LangToggle } from "@/components/lang-toggle";
import { getActiveBillForTable } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QrCode, Store, Utensils } from "lucide-react";

export const metadata = { title: "ROHI — Pagamento" };

/**
 * Guest payment entry point.
 *
 * The QR code on the restaurant table encodes only this URL with an opaque
 * table token: /pay?table=tbl_<hex>. The backend resolves token -> table ->
 * restaurant -> active bill server-side. PT/EN via next-intl.
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const t = await getTranslations("GuestPay");
  const locale = await getLocale();
  const moneyLocale = locale === "en" ? "en" : "pt";
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

  // Resolve the active (OPEN) bill for this table, if any.
  const activeBill =
    table && !invalid ? await getActiveBillForTable(table.id) : null;

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
              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{t("bill")}</span>
                  </CardTitle>
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
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>{t("total")}</span>
                    <span>
                      {formatMoney(
                        activeBill.totalMinor,
                        activeBill.currency,
                        moneyLocale,
                      )}
                    </span>
                  </div>

                  {/* Pay button is disabled until the payment engine lands
                      (Task 6). This sets up the visual checkout affordance. */}
                  <Button className="w-full" disabled>
                    {t("pay")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("payDisabledNote")}
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
