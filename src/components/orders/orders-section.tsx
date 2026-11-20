"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Package, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";

interface OrderItemView {
  id: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  notes: string | null;
}
interface OrderView {
  id: string;
  status: string;
  tableId: string;
  notes: string | null;
  createdAt: string;
  items: OrderItemView[];
  table?: { label: string };
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  SUBMITTED: { label: "Submetido", cls: "bg-[oklch(0.7_0.15_65/0.16)] text-[oklch(0.78_0.15_65)]", icon: Clock },
  RECEIVED: { label: "Recebido", cls: "bg-[oklch(0.7_0.15_65/0.16)] text-[oklch(0.78_0.15_65)]", icon: Clock },
  ACCEPTED: { label: "Aceite", cls: "bg-primary/12 text-primary", icon: Check },
  PREPARING: { label: "A preparar", cls: "bg-primary/12 text-primary", icon: Clock },
  READY: { label: "Pronto", cls: "bg-primary/15 text-primary", icon: Check },
  SERVED: { label: "Servido", cls: "bg-muted text-muted-foreground", icon: Check },
  CANCELLED: { label: "Cancelado", cls: "bg-muted text-muted-foreground", icon: X },
  REJECTED: { label: "Rejeitado", cls: "bg-destructive/12 text-destructive", icon: X },
};

const NEXT_STATUS: Record<string, string | null> = {
  SUBMITTED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: null,
};

export function OrdersSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Poll every 10s for new orders
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setActionLoading(orderId + status);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({ title: `Estado: ${STATUS_CONFIG[status]?.label ?? status}` });
        await load();
        router.refresh();
      } else {
        toast({ title: "Erro", variant: "destructive" });
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

  const activeOrders = orders.filter((o) => !["SERVED", "CANCELLED", "REJECTED"].includes(o.status));
  const pastOrders = orders.filter((o) => ["SERVED", "CANCELLED", "REJECTED"].includes(o.status));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pedidos</h2>
        <p className="text-sm text-muted-foreground">
          Pedidos QR dos clientes · actualiza a cada 10s
        </p>
      </div>

      {activeOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sem pedidos activos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.SUBMITTED;
            const SIcon = cfg.icon;
            const next = NEXT_STATUS[order.status];
            const total = order.items.reduce((s, i) => s + i.quantity * i.unitPriceMinor, 0);
            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 12)}</span>
                        {order.table && (
                          <span className="text-sm font-medium">{order.table.label}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("pt-PT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cfg.cls}>
                      <SIcon className="mr-1 h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="mt-3 divide-y divide-border/60">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                        <div>
                          <span className="font-medium">{item.quantity}× {item.name}</span>
                          {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                        </div>
                        <span className="tabular text-muted-foreground">{formatMoney(item.quantity * item.unitPriceMinor)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold tabular">{formatMoney(total)}</span>
                    <div className="flex gap-2">
                      {order.status === "SUBMITTED" && (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(order.id, "REJECTED")} disabled={!!actionLoading}>
                          {actionLoading === order.id + "REJECTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
                          Rejeitar
                        </Button>
                      )}
                      {next && (
                        <Button size="sm" onClick={() => updateStatus(order.id, next)} disabled={!!actionLoading}>
                          {actionLoading === order.id + next ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          {next === "ACCEPTED" ? "Aceitar" : next === "PREPARING" ? "Preparar" : next === "READY" ? "Pronto" : "Servir"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pastOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Histórico</h3>
          {pastOrders.slice(0, 5).map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.SUBMITTED;
            return (
              <div key={order.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 12)}</span>
                {order.table && <span className="text-xs">{order.table.label}</span>}
                <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
