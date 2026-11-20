import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/url";
import { SignInForm } from "@/components/auth/sign-in-form";
import { DashboardShell } from "@/components/app/dashboard-shell";
import type { TableQrView } from "@/components/tables/table-card";
import type { DashboardStats } from "@/components/dashboard/dashboard-section";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Unauthenticated → sign-in gate.
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
  const canManage = u.activeRole === "OWNER" || u.activeRole === "MANAGER";

  let tables: TableQrView[] = [];
  let stats: DashboardStats = {
    currency: "MZN",
    totalRevenueMinor: 0,
    todayRevenueMinor: 0,
    todayCount: 0,
    succeededCount: 0,
    pendingCount: 0,
    failedCount: 0,
    activeTables: 0,
    openBills: 0,
    revenueSeries: [],
    methodBreakdown: [],
    recentTransactions: [],
  };

  if (hasRestaurant && u.activeRestaurantId) {
    const restaurantId = u.activeRestaurantId;
    const baseUrl = await getBaseUrl();

    // Tables with their active (OPEN) bill summary.
    const tableRows = await db.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: [{ area: "asc" }, { label: "asc" }],
      include: {
        bills: {
          where: { status: "OPEN" },
          select: { id: true, totalMinor: true, currency: true },
          take: 1,
        },
      },
    });
    // Pending payments for active bills (drives "awaiting payment" status).
    const activeBillIds = tableRows.flatMap((t) => t.bills.map((b) => b.id));
    const pendingPayments = activeBillIds.length
      ? await db.payment.findMany({
          where: {
            billId: { in: activeBillIds },
            status: { in: ["INITIATED", "PENDING"] },
          },
          select: { billId: true },
          distinct: ["billId"],
        })
      : [];
    const pendingBillIds = new Set(pendingPayments.map((p) => p.billId));
    tables = await Promise.all(
      tableRows.map(async (t) => {
        const payUrl = `${baseUrl}/pay?table=${t.token}`;
        const ab = t.bills[0] ?? null;
        return {
          id: t.id,
          label: t.label,
          area: t.area,
          status: t.status,
          token: t.token,
          shape: t.shape,
          seats: t.seats,
          posX: t.posX,
          posY: t.posY,
          payUrl,
          qrDataUrl: await generateQrDataUrl(payUrl),
          activeBill: ab
            ? {
                id: ab.id,
                totalMinor: ab.totalMinor,
                currency: ab.currency,
                hasPendingPayment: pendingBillIds.has(ab.id),
              }
            : null,
        } satisfies TableQrView;
      }),
    );

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { currency: true },
    });
    const currency = restaurant?.currency ?? "MZN";

    // Recent payments (with bill → table label) for stats + transactions.
    const payments = await db.payment.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { bill: { include: { table: { select: { label: true } } } } },
    });

    const succeeded = payments.filter((p) => p.status === "SUCCEEDED");
    const pending = payments.filter(
      (p) => p.status === "INITIATED" || p.status === "PENDING",
    );
    const failed = payments.filter((p) => p.status === "FAILED");

    const totalRevenueMinor = succeeded.reduce((s, p) => s + p.amountMinor, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySucceeded = succeeded.filter(
      (p) => p.confirmedAt && p.confirmedAt >= todayStart,
    );
    const todayRevenueMinor = todaySucceeded.reduce(
      (s, p) => s + p.amountMinor,
      0,
    );

    // Revenue series for the last 7 days.
    const now = new Date();
    const revenueSeries: { day: string; revenueMinor: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const e = new Date(d);
      e.setHours(23, 59, 59, 999);
      const rev = succeeded
        .filter((p) => p.confirmedAt && p.confirmedAt >= d && p.confirmedAt <= e)
        .reduce((s, p) => s + p.amountMinor, 0);
      revenueSeries.push({
        day: d.toLocaleDateString("pt-PT", { weekday: "short" }),
        revenueMinor: rev,
      });
    }

    // Payment-method breakdown (by succeeded payments).
    const byMethod = new Map<string, { count: number; amountMinor: number }>();
    for (const p of succeeded) {
      const m = byMethod.get(p.providerCode) ?? { count: 0, amountMinor: 0 };
      m.count += 1;
      m.amountMinor += p.amountMinor;
      byMethod.set(p.providerCode, m);
    }
    const methodBreakdown = [...byMethod.entries()].map(([method, v]) => ({
      method,
      ...v,
    }));

    // Recent transactions + their POS sync status.
    const recent = payments.slice(0, 8);
    const recentBillIds = recent.map((p) => p.billId);
    const syncRecords = await db.posSyncRecord.findMany({
      where: { billId: { in: recentBillIds }, direction: "PAYMENT_CONFIRM" },
      select: { billId: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    const syncByBill = new Map<string, string>();
    for (const r of syncRecords) {
      if (!syncByBill.has(r.billId)) syncByBill.set(r.billId, r.status);
    }
    const recentTransactions = recent.map((p) => ({
      id: p.id,
      amountMinor: p.amountMinor,
      currency: p.currency,
      status: p.status,
      providerCode: p.providerCode,
      tableLabel: p.bill?.table?.label ?? null,
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
      posSyncStatus: syncByBill.get(p.billId) ?? null,
    }));

    const openBills = await db.bill.count({
      where: { restaurantId, status: "OPEN" },
    });

    stats = {
      currency,
      totalRevenueMinor,
      todayRevenueMinor,
      todayCount: todaySucceeded.length,
      succeededCount: succeeded.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      activeTables: tables.filter((t) => !!t.activeBill).length,
      openBills,
      revenueSeries,
      methodBreakdown,
      recentTransactions,
    };
  }

  if (!hasRestaurant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" /> Sem restaurante
            </CardTitle>
            <CardDescription>
              A sua conta não está associada a nenhum restaurante.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <DashboardShell
      user={{
        name: u.name,
        email: u.email,
        activeRole: u.activeRole,
        platformRole: u.platformRole,
        activeRestaurantName: u.activeRestaurantName,
      }}
      tables={tables}
      canManage={canManage}
      stats={stats}
    />
  );
}
