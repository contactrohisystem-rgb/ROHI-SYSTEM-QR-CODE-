"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
}
interface MenuCategoryView {
  id: string;
  name: string;
  products: MenuProduct[];
}

interface BasketItem {
  productId: string;
  name: string;
  priceMinor: number;
  quantity: number;
}

export function GuestMenuView({
  tableToken,
  currency,
  locale,
}: {
  tableToken: string;
  currency: string;
  locale: "pt" | "en";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<MenuCategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/menu?tableToken=${encodeURIComponent(tableToken)}`)
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories ?? []);
        if (d.categories?.length > 0) setActiveCat(d.categories[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tableToken]);

  // Persist basket in localStorage (survives tab switches)
  useEffect(() => {
    const saved = localStorage.getItem(`basket_${tableToken}`);
    if (saved) setBasket(JSON.parse(saved));
  }, [tableToken]);
  useEffect(() => {
    localStorage.setItem(`basket_${tableToken}`, JSON.stringify(basket));
  }, [basket, tableToken]);

  function addToBasket(p: MenuProduct) {
    setBasket((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing)
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [...prev, { productId: p.id, name: p.name, priceMinor: p.priceMinor, quantity: 1 }];
    });
  }
  function changeQty(productId: string, delta: number) {
    setBasket((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }
  function removeFromBasket(productId: string) {
    setBasket((prev) => prev.filter((i) => i.productId !== productId));
  }

  const basketCount = basket.reduce((s, i) => s + i.quantity, 0);
  const basketTotal = basket.reduce((s, i) => s + i.quantity * i.priceMinor, 0);

  async function submitOrder() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken,
          items: basket.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "submit_failed");
      }
      const data = await res.json();
      setOrderRef(data.order?.id?.slice(0, 12) ?? "—");
      setBasket([]);
      localStorage.removeItem(`basket_${tableToken}`);
      toast({ title: locale === "pt" ? "Pedido enviado!" : "Order submitted!" });
    } catch (e) {
      toast({ title: locale === "pt" ? "Erro ao enviar" : "Submit failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        {locale === "pt" ? "A carregar menu..." : "Loading menu..."}
      </div>
    );
  if (categories.length === 0)
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        {locale === "pt" ? "Menu indisponível." : "Menu unavailable."}
      </div>
    );

  const active = categories.find((c) => c.id === activeCat) ?? categories[0];
  const filtered = query
    ? active.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : active.products;

  // Order confirmation
  if (orderRef) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <p className="text-base font-semibold">
          {locale === "pt" ? "Pedido enviado!" : "Order submitted!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {locale === "pt" ? "Referência:" : "Reference:"} <span className="font-mono font-medium">{orderRef}</span>
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          {locale === "pt"
            ? "O restaurante irá receber o seu pedido. Pode acompanhar o estado na aba Conta."
            : "The restaurant will receive your order. Track its status on the Bill tab."}
        </p>
        <Button variant="outline" onClick={() => setOrderRef(null)}>
          {locale === "pt" ? "Continuar a ver o menu" : "Continue browsing"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={locale === "pt" ? "Procurar..." : "Search..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setActiveCat(c.id); setQuery(""); }}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active?.id === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {locale === "pt" ? "Sem resultados." : "No results."}
          </p>
        ) : (
          filtered.map((p) => {
            const qty = basket.find((i) => i.productId === p.id)?.quantity ?? 0;
            const selected = qty > 0;
            return (
              <div key={p.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"}`}>
                {p.imageUrl && <img src={p.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  {p.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</div>}
                  <div className="mt-1 text-sm font-semibold tabular">{formatMoney(p.priceMinor, currency, locale)}</div>
                </div>
                {/* Live quantity selector — immediate visible confirmation */}
                {selected ? (
                  <div className="flex shrink-0 items-center gap-1 rounded-full border border-primary/30 p-1">
                    <button
                      type="button"
                      onClick={() => changeQty(p.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular">{qty}</span>
                    <button
                      type="button"
                      onClick={() => addToBasket(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => addToBasket(p)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Basket bar (fixed at bottom) */}
      {basketCount > 0 && (
        <div className="sticky bottom-3 z-10">
          <button
            type="button"
            onClick={() => setBasketOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" />
              {basketCount} {locale === "pt" ? "itens" : "items"}
            </span>
            <span className="text-sm font-semibold tabular">{formatMoney(basketTotal, currency, locale)}</span>
          </button>
        </div>
      )}

      {/* Basket dialog */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{locale === "pt" ? "Cesto" : "Basket"}</DialogTitle>
            <DialogDescription>
              {locale === "pt" ? "Reveja e confirme o seu pedido" : "Review and confirm your order"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {basket.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {locale === "pt" ? "Cesto vazio" : "Basket empty"}
              </p>
            ) : (
              basket.map((item) => (
                <div key={item.productId} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground tabular">{formatMoney(item.priceMinor, currency, locale)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => changeQty(item.productId, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular">{item.quantity}</span>
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => changeQty(item.productId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular">{formatMoney(item.quantity * item.priceMinor, currency, locale)}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => removeFromBasket(item.productId)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
          {basket.length > 0 && (
            <div className="flex justify-between border-t pt-3 text-sm font-semibold">
              <span>{locale === "pt" ? "Total" : "Total"}</span>
              <span className="tabular">{formatMoney(basketTotal, currency, locale)}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBasketOpen(false)}>
              {locale === "pt" ? "Continuar" : "Continue"}
            </Button>
            <Button onClick={submitOrder} disabled={submitting || basket.length === 0}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {locale === "pt" ? "Enviar pedido" : "Submit order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
