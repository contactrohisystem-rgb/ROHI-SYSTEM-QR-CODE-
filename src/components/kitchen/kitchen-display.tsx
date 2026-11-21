"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Flame, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OrderItemView {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  prepStatus: string;
}
interface OrderView {
  id: string;
  status: string;
  createdAt: string;
  table: { label: string } | null;
  items: OrderItemView[];
}
interface StationView {
  id: string;
  name: string;
}

const PREP_CONFIG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  NEW: { label: "Novo", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40", icon: Clock },
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
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [stations, setStations] = useState<StationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<string | "ALL">("ALL");
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
    return () => clearInterval(interval);
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

  // Filter: all orders have their items; station filtering is visual only
  // (each ticket shows all items; kitchen staff work their station's items)
  const activeOrders = orders.filter(
    (o) => o.status === "ACCEPTED" || o.status === "PREPARING",
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Flame className="h-6 w-6 text-orange-500" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Kitchen Display</h1>
            <p className="text-xs text-zinc-500">{restaurantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stations.length > 0 && (
            <div className="flex gap-1">
              <button
                onClick={() => setActiveStation("ALL")}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  activeStation === "ALL"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Tudo
              </button>
              {stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveStation(s.id)}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    activeStation === s.id
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <a
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
          >
            ← Dashboard
          </a>
        </div>
      </header>

      {/* Tickets grid */}
      <main className="p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-400">Sem pedidos activos</p>
            <p className="text-sm text-zinc-600">Aguardando pedidos aceites</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeOrders.map((order) => {
              const elapsedStr = elapsed(order.createdAt);
              const elapsedMin = Math.floor(
                (Date.now() - new Date(order.createdAt).getTime()) / 60000,
              );
              const isLate = elapsedMin > 15;
              return (
                <div
                  key={order.id}
                  className={`flex flex-col rounded-lg border-2 ${
                    isLate ? "border-red-600/60" : "border-zinc-800"
                  } bg-zinc-900`}
                >
                  {/* Ticket header */}
                  <div
                    className={`flex items-center justify-between rounded-t-md px-4 py-2 ${
                      isLate ? "bg-red-950/40" : "bg-zinc-800/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">#{order.id.slice(-4).toUpperCase()}</span>
                        {order.table && (
                          <span className="text-base font-bold">
                            {order.table.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-mono font-bold ${isLate ? "text-red-400" : "text-zinc-300"}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {elapsedStr}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 divide-y divide-zinc-800">
                    {order.items.map((item) => {
                      const cfg = PREP_CONFIG[item.prepStatus] ?? PREP_CONFIG.NEW;
                      const SIcon = cfg.icon;
                      const next = NEXT_PREP[item.prepStatus];
                      return (
                        <div key={item.id} className="px-4 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">
                                  {item.quantity}×
                                </span>
                                <span className="text-base font-medium text-zinc-100">
                                  {item.name}
                                </span>
                              </div>
                              {item.notes && (
                                <p className="mt-0.5 text-xs italic text-amber-400/80">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`shrink-0 border ${cfg.cls}`}
                            >
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
                                "Iniciar"
                              ) : next === "READY" ? (
                                "Pronto ✓"
                              ) : (
                                "Concluir"
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Order status footer */}
                  <div className="rounded-b-md border-t border-zinc-800 bg-zinc-800/30 px-4 py-2 text-center text-xs font-medium">
                    {order.status === "ACCEPTED" ? (
                      <span className="text-blue-400">Aguarda preparação</span>
                    ) : order.status === "PREPARING" ? (
                      <span className="text-amber-400">Em preparação</span>
                    ) : order.status === "READY" ? (
                      <span className="text-green-400">Pronto para servir</span>
                    ) : (
                      <span className="text-zinc-500">{order.status}</span>
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
