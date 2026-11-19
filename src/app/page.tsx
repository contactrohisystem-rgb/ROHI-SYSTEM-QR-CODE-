import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/url";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TablesSection } from "@/components/tables/tables-section";
import type { TableQrView } from "@/components/tables/table-card";
import { PosSection } from "@/components/pos/pos-section";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Unauthenticated: sign-in gate.
  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-4">
          <SignInForm />
        </div>
        <footer className="border-t p-4 text-center text-xs text-muted-foreground">
          ROHI — Pagamento QR para restaurantes · Moçambique
        </footer>
      </main>
    );
  }

  const u = session.user;
  const hasRestaurant = !!u.activeRestaurantId && !!u.activeRole;
  // Table create/delete + bill void = MANAGER+. Bill open/items = SERVER+.
  const canManage =
    u.activeRole === "OWNER" || u.activeRole === "MANAGER";

  let tables: TableQrView[] = [];
  if (hasRestaurant && u.activeRestaurantId) {
    const baseUrl = await getBaseUrl();
    const rows = await db.restaurantTable.findMany({
      where: { restaurantId: u.activeRestaurantId },
      orderBy: [{ area: "asc" }, { label: "asc" }],
      include: {
        // Active (OPEN) bill for the table — at most one by invariant.
        bills: {
          where: { status: "OPEN" },
          select: { id: true, totalMinor: true, currency: true },
          take: 1,
        },
      },
    });
    tables = await Promise.all(
      rows.map(async (t) => {
        const payUrl = `${baseUrl}/pay?table=${t.token}`;
        return {
          id: t.id,
          label: t.label,
          area: t.area,
          status: t.status,
          token: t.token,
          payUrl,
          qrDataUrl: await generateQrDataUrl(payUrl),
          activeBill: t.bills[0] ?? null,
        } satisfies TableQrView;
      }),
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">ROHI</span>
            {u.activeRestaurantName && (
              <Badge variant="secondary">{u.activeRestaurantName}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium leading-tight">
                {u.name ?? u.email}
              </div>
              {u.activeRole && (
                <div className="text-xs text-muted-foreground">
                  {u.activeRole}
                </div>
              )}
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl flex-1 space-y-8 p-4">
        {hasRestaurant ? (
          <>
            <TablesSection tables={tables} canManage={canManage} />
            {canManage && (
              <PosSection
                tables={tables.map((t) => ({
                  id: t.id,
                  label: t.label,
                  hasOpenBill: !!t.activeBill,
                }))}
              />
            )}
          </>
            ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" /> Sem restaurante
              </CardTitle>
              <CardDescription>
                A sua conta não está associada a nenhum restaurante.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl p-4 text-center text-xs text-muted-foreground">
          ROHI — Pagamento QR para restaurantes · Moçambique
        </div>
      </footer>
    </main>
  );
}
