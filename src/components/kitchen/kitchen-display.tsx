"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  Package,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OrderItemView {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  prepStatus: string;
  // Flattened station routing (resolved server-side from productId → Product.kitchenStationId).
  kitchenStationId: string | null;
}
interface OrderView {
  id: string;
  status: string;
  createdAt: string;
  notes: string | null;
  table: { label: string } | null;
  items: OrderItemView[];
}
interface StationView {
  id: string;
  name: string;
}

const PREP_CONFIG: Record<
  string,
  { label: string; cls: string; icon: typeof Clock }
> = {
  NEW: { label: "Novo", cls: "bg-sky-500/20 text-sky-300 border-sky-500/40", icon: Clock },
  PREPARING: { label: "A preparar", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: Flame },
  READY: { label: "Pronto", cls: "bg-green-500/20 text-green-300 border-green-500/40", icon: CheckCircle2 },
  COMPLETED: { label: "Concluído", cls: "bg-zinc-600/30 text-zinc-400 border-zinc-600/40", icon: CheckCircle2 },
};

const NEXT_PREP: Record<string, string> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

function elapsed(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function KitchenDisplay({
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  const [stations, setStations] = useState<StationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<string>("ALL");
  const [now, setNow] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/kitchen/tickets");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setStations(data.stations ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    // Tick the clock every second so timers update smoothly.
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  async function updateItem(itemId: string, prepStatus: string) {
    setActionLoading(itemId + prepStatus);
    try {
      await fetch(`/api/kitchen/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepStatus }),
      });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  function bumpOrder(orderId: string) {
    setBumped((prev) => new Set(prev).add(orderId));
    // Auto-clear from view after a short recap delay (kept until next refresh).
  }

  // Split into active and ready-to-bump.
  // Active: ACCEPTED / PREPARING, or READY orders not yet bumped.
  // Recap (recently bumped): show briefly with a "served" state.
  const visibleOrders = useMemo(() => {
    return orders.filter((o) => !bumped.has(o.id));
  }, [orders, bumped]);

  // When a station is selected, only items routed to that station are shown
  // within each ticket (other stations' items are hidden). "ALL" shows every
  // item. Items with no station routing (null) appear in ALL and also when
  // their station is selected? No — null station items appear only in ALL +
  // a "Sem estação" virtual filter. We keep it simple: null-station items show
  // in ALL and in the default "Sem estação" pseudo-station.
  function itemStationMatches(item: OrderItemView): boolean {
    if (activeStation === "ALL") return true;
    return item.kitchenStationId === activeStation;
  }

  // Ticket station filter: only show a ticket if it has at least one item
  // matching the active station (so a "Bar" station view doesn't show
  // grill-only tickets).
  const filteredOrders = visibleOrders.filter((o) => {
    if (activeStation === "ALL") return true;
    return o.items.some(itemStationMatches);
  });

  // Summary counts per station (for the filter tabs).
  const stationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of visibleOrders) {
      for (const item of o.items) {
        const sid = item.kitchenStationId ?? "__none__";
        if (item.prepStatus !== "COMPLETED") {
          counts.set(sid, (counts.get(sid) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [visibleOrders]);

  const totalActiveItems = visibleOrders.reduce(
    (s, o) => s + o.items.filter((i) => i.prepStatus !== "COMPLETED").length,
    0,
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Flame className="h-6 w-6 text-orange-500" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Kitchen Display</h1>
            <p className="text-xs text-zinc-500">{restaurantName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Package className="h-3.5 w-3.5" />
            <span className="font-medium text-zinc-200">{filteredOrders.length}</span> tickets
            <span className="mx-1 text-zinc-700">·</span>
            <span className="font-medium text-zinc-200">{totalActiveItems}</span> itens activos
          </div>
          <a
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
          >
            ← Dashboard
          </a>
        </div>
      </header>

      {/* Station filter row */}
      {stations.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-zinc-900 bg-zinc-950 px-6 py-2">
          <button
            onClick={() => setActiveStation("ALL")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              activeStation === "ALL"
                ? "bg-orange-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            Tudo <span className="ml-1 text-[10px] opacity-70">{totalActiveItems}</span>
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStation(s.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeStation === s.id
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {s.name}
              <span className="ml-1 text-[10px] opacity-70">{stationCounts.get(s.id) ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tickets grid */}
      <main className="p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-400">Sem pedidos activos</p>
            <p className="text-sm text-zinc-600">
              {activeStation === "ALL"
                ? "Aguardando pedidos aceites"
                : "Nenhum item para esta estação"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOrders.map((order) => {
              const elapsedStr = elapsed(order.createdAt);
              const elapsedMin = Math.floor(
                (now - new Date(order.createdAt).getTime()) / 60000,
              );
              const isLate = elapsedMin > 15;
              const isWarning = elapsedMin > 8 && !isLate;
              const visibleItems = order.items.filter(itemStationMatches);
              const allReadyOrCompleted = order.items.every(
                (i) => i.prepStatus === "READY" || i.prepStatus === "COMPLETED",
              );
              const isReady = order.status === "READY" || allReadyOrCompleted;
              return (
                <div
                  key={order.id}
                  className={`flex flex-col rounded-lg border-2 bg-zinc-900 ${
                    isReady
                      ? "border-green-600/60"
                      : isLate
                        ? "border-red-600/60"
                        : isWarning
                          ? "border-amber-600/50"
                          : "border-zinc-800"
                  }`}
                >
                  {/* Ticket header */}
                  <div
                    className={`flex items-center justify-between rounded-t-md px-4 py-2 ${
                      isReady
                        ? "bg-green-950/40"
                        : isLate
                          ? "bg-red-950/40"
                          : isWarning
                            ? "bg-amber-950/30"
                            : "bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">#{order.id.slice(-4).toUpperCase()}</span>
                      {order.table && (
                        <span className="text-base font-bold">{order.table.label}</span>
                      )}
                      {isReady && (
                        <Badge variant="outline" className="border-green-500/40 bg-green-500/20 text-green-300">
                          <CheckCircle2 className="mr-1 h-3 w-3" />Pronto
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`flex items-center gap-1 font-mono text-sm font-bold ${
                        isReady ? "text-green-400" : isLate ? "text-red-400" : isWarning ? "text-amber-400" : "text-zinc-300"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {elapsedStr}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 divide-y divide-zinc-800">
                    {visibleItems.map((item) => {
                      const cfg = PREP_CONFIG[item.prepStatus] ?? PREP_CONFIG.NEW;
                      const SIcon = cfg.icon;
                      const next = NEXT_PREP[item.prepStatus];
                      const done = item.prepStatus === "COMPLETED";
                      return (
                        <div
                          key={item.id}
                          className={`px-4 py-2.5 ${done ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">{item.quantity}×</span>
                                <span className={`text-base font-medium ${done ? "line-through text-zinc-500" : "text-zinc-100"}`}>
                                  {item.name}
                                </span>
                              </div>
                              {item.notes && (
                                <p className="mt-0.5 text-xs italic text-amber-400/80">↳ {item.notes}</p>
                              )}
                            </div>
                            <Badge variant="outline" className={`shrink-0 border ${cfg.cls}`}>
                              <SIcon className="mr-1 h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </div>
                          {next && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1.5 h-7 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
                              onClick={() => updateItem(item.id, next)}
                              disabled={actionLoading === item.id + next}
                            >
                              {actionLoading === item.id + next ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : next === "PREPARING" ? (
                                <>Iniciar <ChevronRight className="ml-1 h-3 w-3" /></>
                              ) : next === "READY" ? (
                                <>Pronto ✓</>
                              ) : (
                                "Concluir"
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {visibleItems.length === 0 && (
                      <div className="px-4 py-3 text-center text-xs text-zinc-600">
                        Sem itens para esta estação
                      </div>
                    )}
                  </div>

                  {/* Order notes (kitchen-facing) */}
                  {order.notes && (
                    <div className="border-t border-zinc-800 bg-amber-950/20 px-4 py-1.5 text-xs italic text-amber-300/90">
                      Nota: {order.notes}
                    </div>
                  )}

                  {/* Footer / bump */}
                  <div className="flex items-center justify-between rounded-b-md border-t border-zinc-800 bg-zinc-800/30 px-4 py-2">
                    <span className="text-xs font-medium text-zinc-400">
                      {order.status === "ACCEPTED" ? "Aguarda preparação"
                        : order.status === "PREPARING" ? "Em preparação"
                        : order.status === "READY" ? "Pronto para servir"
                        : order.status}
                    </span>
                    {isReady && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-green-400 hover:bg-green-950/40 hover:text-green-300"
                        onClick={() => bumpOrder(order.id)}
                      >
                        <X className="mr-1 h-3 w-3" />Bump
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
