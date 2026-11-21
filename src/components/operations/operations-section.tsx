"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  LogIn,
  Package,
  Table2,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Front-of-house daily operations overview (Stage 13E).
 *
 * A consolidated live view for the floor manager: incoming/active orders,
 * today's reservation timeline, and table status with attention flags.
 * Fetches from the existing staff APIs (orders, reservations, tables) and
 * auto-refreshes every 15s. No new backend — reuses tenant-scoped endpoints.
 */

interface OrderItemView { id: string; name: string; quantity: number; notes: string | null; }
interface OrderView {
  id: string;
  status: string;
  tableId: string;
  notes: string | null;
  createdAt: string;
  items: OrderItemView[];
  table?: { label: string };
}
interface ReservationView {
  id: string;
  customerName: string;
  phone: string;
  partySize: number;
  date: string;
  durationMins: number;
  areaPreference: string | null;
  notes: string | null;
  status: string;
  table: { id: string; label: string } | null;
  reference?: string | null;
}
interface TableView {
  id: string;
  label: string;
  area: string | null;
  seats: number;
  status: string;
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "Novo", cls: "bg-amber-500/15 text-amber-600" },
  RECEIVED: { label: "Recebido", cls: "bg-amber-500/15 text-amber-600" },
  ACCEPTED: { label: "Aceite", cls: "bg-primary/12 text-primary" },
  PREPARING: { label: "A preparar", cls: "bg-orange-500/15 text-orange-600" },
  READY: { label: "Pronto", cls: "bg-green-600/15 text-green-600" },
  SERVED: { label: "Servido", cls: "bg-muted text-muted-foreground" },
};

const RES_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-amber-500/15 text-amber-600" },
  CONFIRMED: { label: "Confirmada", cls: "bg-primary/12 text-primary" },
  SEATED: { label: "Sentado", cls: "bg-green-600/15 text-green-600" },
  COMPLETED: { label: "Concluída", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  NO_SHOW: { label: "No-show", cls: "bg-destructive/12 text-destructive" },
};

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export function OperationsSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [reservations, setReservations] = useState<ReservationView[]>([]);
  const [tables, setTables] = useState<TableView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [oRes, rRes, tRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/reservations"),
        fetch("/api/tables"),
      ]);
      if (oRes.ok) { const d = await oRes.json(); setOrders(d.orders ?? []); }
      if (rRes.ok) { const d = await rRes.json(); setReservations(d.reservations ?? []); }
      if (tRes.ok) { const d = await tRes.json(); setTables(d.tables ?? []); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function advanceOrder(orderId: string, status: string) {
    setActionLoading(orderId + status);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: `Estado: ${ORDER_STATUS[status]?.label ?? status}` });
        await load();
        router.refresh();
      } else {
        toast({ title: "Erro", variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function seatReservation(rsvId: string) {
    setActionLoading(rsvId + "SEATED");
    try {
      const res = await fetch(`/api/reservations/${rsvId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SEATED" }),
      });
      if (res.ok) {
        toast({ title: "Cliente sentado" });
        await load();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const now = new Date();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

  const incoming = orders.filter((o) => o.status === "SUBMITTED" || o.status === "RECEIVED");
  const todayRes = reservations
    .filter((r) => {
      const rd = new Date(r.date);
      return rd >= dayStart && rd <= dayEnd && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(r.status);
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const reservedTables = tables.filter((t) => t.status === "RESERVED").length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Operações</h2>
        <p className="text-sm text-muted-foreground">
          Vista de serviço · actualiza a cada 15s
        </p>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />A chegar</div>
          <div className="mt-1 text-2xl font-bold tabular">{incoming.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5" />A preparar</div>
          <div className="mt-1 text-2xl font-bold tabular">{orders.filter((o) => o.status === "PREPARING").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Prontos</div>
          <div className="mt-1 text-2xl font-bold tabular">{orders.filter((o) => o.status === "READY").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Reservas hoje</div>
          <div className="mt-1 text-2xl font-bold tabular">{todayRes.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Table2 className="h-3.5 w-3.5" />Mesas livres</div>
          <div className="mt-1 text-2xl font-bold tabular">{availableTables}/{tables.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Sentados</div>
          <div className="mt-1 text-2xl font-bold tabular">{reservations.filter((r) => r.status === "SEATED").length}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Orders needing action */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Pedidos a precisar de acção
              </h3>
              <Badge variant="secondary">{incoming.length + orders.filter((o) => o.status === "READY").length}</Badge>
            </div>
            {incoming.length === 0 && orders.filter((o) => o.status === "READY").length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tudo sob controlo.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {incoming.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {o.table && <span className="text-sm font-medium">{o.table.label}</span>}
                        <Badge variant="secondary" className={ORDER_STATUS.SUBMITTED.cls}>{ORDER_STATUS[o.status]?.label}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
                    </div>
                    <Button size="sm" onClick={() => advanceOrder(o.id, "ACCEPTED")} disabled={!!actionLoading}>
                      {actionLoading === o.id + "ACCEPTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aceitar"}
                    </Button>
                  </div>
                ))}
                {orders.filter((o) => o.status === "READY").map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {o.table && <span className="text-sm font-medium">{o.table.label}</span>}
                        <Badge variant="secondary" className={ORDER_STATUS.READY.cls}>Pronto</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
                    </div>
                    <Button size="sm" onClick={() => advanceOrder(o.id, "SERVED")} disabled={!!actionLoading}>
                      {actionLoading === o.id + "SERVED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Servir"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's reservations timeline */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                Reservas de hoje
              </h3>
              <Badge variant="secondary">{todayRes.length}</Badge>
            </div>
            {todayRes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem reservas hoje.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {todayRes.map((r) => {
                  const cfg = RES_STATUS[r.status] ?? RES_STATUS.PENDING;
                  const isImminent = new Date(r.date) <= new Date(now.getTime() + 30 * 60_000) && r.status === "CONFIRMED";
                  return (
                    <div key={r.id} className={`rounded-lg border px-3 py-2 ${isImminent ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {timeStr(r.date)}
                        </span>
                        <Badge variant="secondary" className={cfg.cls + " text-[10px]"}>{cfg.label}</Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />{r.partySize} pax
                        {r.table && <span>· {r.table.label}</span>}
                      </div>
                      <div className="truncate text-xs">{r.customerName}</div>
                      {r.status === "CONFIRMED" && (
                        <Button size="sm" variant="outline" className="mt-1.5 h-7 w-full text-xs" onClick={() => seatReservation(r.id)} disabled={!!actionLoading}>
                          {actionLoading === r.id + "SEATED" ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogIn className="mr-1 h-3 w-3" />}
                          Sentar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table status grid */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Table2 className="h-4 w-4" />Estado das mesas
            </h3>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/60" />{availableTables} livres</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />{occupiedTables} ocupadas</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{reservedTables} reservadas</span>
            </div>
          </div>
          {tables.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sem mesas.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {tables.map((t) => {
                const cls = t.status === "AVAILABLE" ? "border-primary/30 bg-primary/5 text-primary"
                  : t.status === "OCCUPIED" ? "border-orange-500/30 bg-orange-500/5 text-orange-600"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-600";
                return (
                  <div key={t.id} className={`rounded-lg border px-2 py-1.5 text-center ${cls}`}>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-[10px] uppercase">{t.status === "AVAILABLE" ? "Livre" : t.status === "OCCUPIED" ? "Ocupada" : "Reservada"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
