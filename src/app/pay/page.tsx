import { db } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import { LangToggle } from "@/components/lang-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QrCode, Store, Utensils } from "lucide-react";

export const metadata = { title: "ROHI — Pagamento" };

/**
 * Guest payment entry point.
 *
 * The QR code on the restaurant table encodes only this URL with an opaque
 * table token: /pay?table=tbl_<hex>. The token carries NO bill data, amount,
 * or authorization — the backend resolves token -> table -> restaurant on
 * every request and looks up the active bill server-side.
 *
 * This route is PUBLIC (no auth). It is mobile-first and PT/EN via next-intl.
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const t = await getTranslations("GuestPay");
  const locale = await getLocale();
  const { table: token } = await searchParams;

  // Resolve the opaque token server-side. If missing/invalid/inactive
  // restaurant, show a safe "invalid code" state with no data leakage.
  const table = token
    ? await db.restaurantTable.findUnique({
        where: { token },
        include: {
          restaurant: { select: { id: true, name: true, status: true } },
        },
      })
    : null;

  const invalid = !table || table.restaurant.status !== "active";

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

            {/* No active bill yet — the billing engine arrives in Task 4.
                For now this is the honest state: the table is identified but
                there is no bill to pay. */}
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <QrCode className="h-10 w-10 text-muted-foreground" />
                <p className="text-base font-medium">{t("noActiveBill")}</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {t("noActiveBillDescription")}
                </p>
              </CardContent>
            </Card>
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
