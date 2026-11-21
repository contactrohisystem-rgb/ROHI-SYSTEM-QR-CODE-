"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Clock,
  CreditCard,
  Receipt,
  Table2,
  TrendingUp,
  Wallet,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { KpiCard } from "./kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatMoney, formatMinorToDecimal } from "@/lib/money";
import type { TableQrView } from "@/components/tables/table-card";

export interface DashboardStats {
  currency: string;
  totalRevenueMinor: number;
  todayRevenueMinor: number;
  todayCount: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  activeTables: number;
  openBills: number;
  pendingOrders: number;
  activeOrders: number;
  revenueSeries: { day: string; revenueMinor: number }[];
  methodBreakdown: {
    method: string;
    count: number;
    amountMinor: number;
  }[];
  recentTransactions: {
    id: string;
    amountMinor: number;
    currency: string;
    status: string;
    providerCode: string;
    tableLabel: string | null;
    confirmedAt: string | null;
    posSyncStatus: string | null;
  }[];
}

const METHOD_LABEL: Record<string, string> = {
  MOCK: "M-Pesa (Demo)",
  MPESA: "M-Pesa",
  EMOLA: "e-Mola",
  CARD: "Card",
};

const METHOD_COLOR = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const STATUS_STYLE: Record<string, string> = {
  SUCCEEDED: "bg-primary/12 text-primary",
  INITIATED: "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]",
  PENDING: "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]",
  FAILED: "bg-destructive/12 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted text-muted-foreground",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  SUCCEEDED: CheckCircle2,
  INITIATED: Clock,
  PENDING: Clock,
  FAILED: XCircle,
  CANCELLED: XCircle,
  REFUNDED: AlertCircle,
};

function ChartTooltip({ active, payload, currency }: { active?: boolean; payload?: { value: number }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <span className="font-medium tabular text-popover-foreground">
        {formatMoney(payload[0].value, currency, "pt")}
      </span>
    </div>
  );
}

export function DashboardSection({
  stats,
  tables,
}: {
  stats: DashboardStats;
  tables: TableQrView[];
}) {
  const cur = stats.currency;
  const totalRev = formatMoney(stats.totalRevenueMinor, cur, "pt");
  const todayRev = formatMoney(stats.todayRevenueMinor, cur, "pt");

  const chartData = stats.revenueSeries.map((d) => ({
    day: d.day,
    value: Number(formatMinorToDecimal(d.revenueMinor, cur)),
  }));

  const donutData = stats.methodBreakdown.map((m) => ({
    name: METHOD_LABEL[m.method] ?? m.method,
    value: Number(formatMinorToDecimal(m.amountMinor, cur)),
    count: m.count,
  }));
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Receita total"
          value={totalRev}
          icon={Wallet}
          tone="primary"
          hint={`${stats.succeededCount} pagamentos bem-sucedidos`}
        />
        <KpiCard
          label="Hoje"
          value={todayRev}
          icon={TrendingUp}
          tone="primary"
          hint={`${stats.todayCount} transacções hoje`}
        />
        <KpiCard
          label="Pendentes"
          value={String(stats.pendingCount)}
          icon={Clock}
          tone="amber"
          hint="A aguardar confirmação"
        />
        <KpiCard
          label="Falhadas"
          value={String(stats.failedCount)}
          icon={AlertCircle}
          tone="rose"
          hint="Necessita atenção"
        />
        <KpiCard
          label="Mesas activas"
          value={String(stats.activeTables)}
          icon={Table2}
          tone="teal"
          hint="Com conta aberta"
        />
        <KpiCard
          label="Contas abertas"
          value={String(stats.openBills)}
          icon={Receipt}
          tone="neutral"
          hint="Aguardam pagamento"
        />
        <KpiCard
          label="Pedidos pendentes"
          value={String(stats.pendingOrders)}
          icon={Clock}
          tone="amber"
          hint="Aguardam aceitação"
        />
        <KpiCard
          label="Pedidos activos"
          value={String(stats.activeOrders)}
          icon={Receipt}
          tone="teal"
          hint="Em preparação / prontos"
        />
        <KpiCard
          label="Transacções"
          value={String(stats.succeededCount)}
          icon={CheckCircle2}
          tone="primary"
          hint="Pagamentos confirmados"
        />
        <KpiCard
          label="Pagamentos"
          value={formatMoney(stats.todayRevenueMinor, cur, "pt")}
          icon={CreditCard}
          tone="neutral"
          hint="Receita de hoje"
        />
      </div>

      {/* Revenue + method breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita — últimos 7 dias
            </CardTitle>
            <span className="text-lg font-semibold tabular">{totalRev}</span>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    content={<ChartTooltip currency={cur} />}
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Métodos de pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={METHOD_COLOR[i % METHOD_COLOR.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                              <span className="font-medium text-popover-foreground">
                                {payload[0].name}
                              </span>
                              <span className="ml-2 tabular text-muted-foreground">
                                {formatMoney(
                                  Math.round(payload[0].value * 100),
                                  cur,
                                  "pt",
                                )}
                              </span>
                            </div>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total
                    </span>
                    <span className="text-sm font-semibold tabular">
                      {formatMoney(stats.totalRevenueMinor, cur, "pt")}
                    </span>
                  </div>
                </div>
                <div className="w-full space-y-1.5">
                  {donutData.map((d, i) => (
                    <div
                      key={d.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: METHOD_COLOR[i % METHOD_COLOR.length] }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                      </span>
                      <span className="tabular font-medium">
                        {formatMoney(Math.round(d.value * 100), cur, "pt")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Transacções recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recentTransactions.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Sem transacções recentes
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentTransactions.slice(0, 8).map((tx) => {
                const SIcon = STATUS_ICON[tx.status] ?? Clock;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-6 py-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        STATUS_STYLE[tx.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      <SIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {tx.tableLabel ?? "—"}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          {METHOD_LABEL[tx.providerCode] ?? tx.providerCode}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {tx.confirmedAt
                          ? new Date(tx.confirmedAt).toLocaleString("pt-PT", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                        {tx.posSyncStatus && (
                          <>
                            {" · POS: "}
                            <span
                              className={
                                tx.posSyncStatus === "SUCCEEDED"
                                  ? "text-primary"
                                  : tx.posSyncStatus === "FAILED"
                                    ? "text-destructive"
                                    : ""
                              }
                            >
                              {tx.posSyncStatus}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular">
                        {formatMoney(tx.amountMinor, tx.currency, "pt")}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {tx.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Actividade de mesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sem mesas
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{t.label}</div>
                      {t.area && (
                        <div className="text-[10px] text-muted-foreground">
                          {t.area}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      t.activeBill
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {t.activeBill
                      ? formatMoney(t.activeBill.totalMinor, t.activeBill.currency, "pt")
                      : "Livre"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
