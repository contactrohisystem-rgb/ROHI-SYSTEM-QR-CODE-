"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Minus, Package, Plus, Search, ShoppingCart, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // New-order dialog (staff-created)
  const [newOpen, setNewOpen] = useState(false);
  const [newTableId, setNewTableId] = useState<string>("");
  const [newTables, setNewTables] = useState<{ id: string; label: string; area: string | null }[]>([]);
  const [menuCats, setMenuCats] = useState<{ id: string; name: string; products: { id: string; name: string; priceMinor: number }[] }[]>([]);
  const [basket, setBasket] = useState<{ productId: string; name: string; priceMinor: number; quantity: number }[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function openNewOrder() {
    setNewOpen(true);
    setBasket([]);
    setSearch("");
    // Lazy-load tables + available products.
    const [tRes, mRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/menu/products"),
    ]);
    if (tRes.ok) {
      const d = await tRes.json();
      const tList = (d.tables ?? []).map((t: { id: string; label: string; area: string | null }) => ({ id: t.id, label: t.label, area: t.area }));
      setNewTables(tList);
      if (tList.length > 0 && !newTableId) setNewTableId(tList[0].id);
    }
    if (mRes.ok) {
      const d = await mRes.json();
      setMenuCats(d.categories ?? []);
    }
  }

  function addToBasket(p: { id: string; name: string; priceMinor: number }) {
    setBasket((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) return prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, name: p.name, priceMinor: p.priceMinor, quantity: 1 }];
    });
  }
  function changeQty(productId: string, delta: number) {
    setBasket((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  }

  const basketTotal = basket.reduce((s, i) => s + i.quantity * i.priceMinor, 0);

  async function submitStaffOrder() {
    if (!newTableId || basket.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: newTableId,
          items: basket.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        toast({ title: "Pedido criado e enviado para a cozinha" });
        setNewOpen(false);
        await load();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setCreating(false);
    }
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Pedidos QR + criados pelo staff · actualiza a cada 10s
          </p>
        </div>
        <Button size="sm" onClick={openNewOrder}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo pedido
        </Button>
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

      {/* Staff-created order dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo pedido</DialogTitle>
            <DialogDescription>
              Crie um pedido para uma mesa — é enviado directamente para a cozinha (Aceite).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mesa</Label>
              <Select value={newTableId} onValueChange={setNewTableId}>
                <SelectTrigger><SelectValue placeholder="Escolha a mesa" /></SelectTrigger>
                <SelectContent>
                  {newTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}{t.area ? ` · ${t.area}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Produtos</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Procurar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60">
                {menuCats.flatMap((c) =>
                  c.products
                    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToBasket(p)}
                        className="flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                      >
                        <span className="min-w-0 truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">{formatMoney(p.priceMinor)}</span>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                      </button>
                    )),
                )}
                {menuCats.flatMap((c) => c.products).length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">Sem produtos disponíveis.</p>
                )}
              </div>
            </div>

            {/* Basket */}
            {basket.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border/60 p-2">
                {basket.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => changeQty(item.productId, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center font-medium tabular">{item.quantity}</span>
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => changeQty(item.productId, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="w-16 text-right tabular">{formatMoney(item.quantity * item.priceMinor)}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => changeQty(item.productId, -item.quantity)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatMoney(basketTotal)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={submitStaffOrder} disabled={creating || !newTableId || basket.length === 0}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-1.5 h-4 w-4" />}
              Enviar para cozinha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
