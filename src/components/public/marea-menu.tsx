"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceMinor: number;
  imageUrl: string | null;
  featured: boolean;
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

const SERIF = "var(--font-playfair), Georgia, 'Times New Roman', serif";

/**
 * MARÉA digital menu (Stage: MARÉA prototype).
 *
 * Premium mobile-first menu with category navigation, food photography,
 * bilingual dish names (PT primary / EN secondary), prices in MT, featured
 * indicators, search, and a basket that submits a preorder to the kitchen.
 */
export function MareaMenu({
  slug,
  currency,
  locale,
}: {
  slug: string;
  currency: string;
  locale: "pt" | "en";
}) {
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
    fetch(`/api/restaurants/${encodeURIComponent(slug)}/menu`)
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories ?? []);
        if (d.categories?.length > 0) setActiveCat(d.categories[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Persist basket in localStorage (survives tab switches)
  useEffect(() => {
    const saved = localStorage.getItem(`marea_basket_${slug}`);
    if (saved) setBasket(JSON.parse(saved));
  }, [slug]);
  useEffect(() => {
    localStorage.setItem(`marea_basket_${slug}`, JSON.stringify(basket));
  }, [basket, slug]);

  function addToBasket(p: MenuProduct) {
    setBasket((prev) => {
      const ex = prev.find((i) => i.productId === p.id);
      if (ex) return prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { productId: p.id, name: p.name, priceMinor: p.priceMinor, quantity: 1 }];
    });
  }
  function changeQty(productId: string, delta: number) {
    setBasket((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
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
          restaurantSlug: slug,
          items: basket.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrderRef(data.order?.id?.slice(0, 12).toUpperCase() ?? "—");
        setBasket([]);
        localStorage.removeItem(`marea_basket_${slug}`);
        toast({ title: locale === "pt" ? "Pré-encomenda enviada!" : "Pre-order submitted!" });
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="py-16 text-center text-sm text-[#173C32]/60">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" style={{ color: "#173C32" }} />
        {locale === "pt" ? "A carregar o menu..." : "Loading menu..."}
      </div>
    );
  if (categories.length === 0)
    return (
      <div className="py-16 text-center text-sm text-[#173C32]/60">
        {locale === "pt" ? "Menu indisponível." : "Menu unavailable."}
      </div>
    );

  // Order confirmation
  if (orderRef) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(23,60,50,0.1)" }}>
          <Check className="h-9 w-9" style={{ color: "#173C32" }} />
        </div>
        <h3 className="mt-4 text-2xl font-medium" style={{ fontFamily: SERIF, color: "#173C32" }}>
          {locale === "pt" ? "Pré-encomenda recebida" : "Pre-order received"}
        </h3>
        <p className="mt-2 text-sm text-[#173C32]/70">
          {locale === "pt"
            ? "A equipa MARÉA irá confirmar a sua encomenda. Apresente esta referência no restaurante."
            : "The MARÉA team will confirm your order. Present this reference at the restaurant."}
        </p>
        <p className="mt-4 font-mono text-lg font-semibold tracking-wider" style={{ color: "#C6A66B" }}>
          {orderRef}
        </p>
        <Button
          variant="outline"
          className="mt-6 border-[#173C32]/30 text-[#173C32]"
          onClick={() => setOrderRef(null)}
        >
          {locale === "pt" ? "Continuar a ver o menu" : "Continue browsing"}
        </Button>
      </div>
    );
  }

  const active = categories.find((c) => c.id === activeCat) ?? categories[0];
  const filtered = query
    ? active.products.filter((p) =>
        (p.name + " " + (p.nameEn ?? "") + " " + (p.description ?? "")).toLowerCase().includes(query.toLowerCase()),
      )
    : active.products;

  return (
    <div>
      {/* Search */}
      <div className="relative mx-auto mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#173C32]/40" />
        <Input
          placeholder={locale === "pt" ? "Procurar prato..." : "Search dishes..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 border-[#173C32]/15 bg-white pl-10"
        />
      </div>

      {/* Category navigation */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setActiveCat(c.id); setQuery(""); }}
            className={`rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-all ${
              active?.id === c.id
                ? "text-white shadow-sm"
                : "text-[#173C32]/70 hover:text-[#173C32]"
            }`}
            style={active?.id === c.id ? { background: "#173C32" } : { background: "rgba(23,60,50,0.06)" }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Dish grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <DishCard key={p.id} product={p} currency={currency} locale={locale} onAdd={() => addToBasket(p)} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-[#173C32]/50">
          {locale === "pt" ? "Sem resultados." : "No results."}
        </p>
      )}

      {/* Basket bar (sticky) */}
      {basketCount > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-md">
          <button
            type="button"
            onClick={() => setBasketOpen(true)}
            className="flex w-full items-center justify-between rounded-full px-6 py-3.5 text-white shadow-xl transition-transform hover:scale-[1.01]"
            style={{ background: "#173C32" }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" />
              {basketCount} {locale === "pt" ? "itens" : "items"}
            </span>
            <span className="text-sm font-semibold tabular" style={{ color: "#C6A66B" }}>
              {formatMoney(basketTotal, currency, locale)}
            </span>
          </button>
        </div>
      )}

      {/* Basket dialog */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: SERIF, color: "#173C32" }}>
              {locale === "pt" ? "A sua encomenda" : "Your order"}
            </DialogTitle>
            <DialogDescription>
              {locale === "pt" ? "Reveja e confirme a sua pré-encomenda" : "Review and confirm your pre-order"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {basket.map((item) => (
              <div key={item.productId} className="flex items-center gap-2 rounded-lg border border-[#173C32]/10 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: "#173C32" }}>{item.name}</div>
                  <div className="text-xs text-[#173C32]/50 tabular">{formatMoney(item.priceMinor, currency, locale)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 w-7 border-[#173C32]/20 p-0" onClick={() => changeQty(item.productId, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium tabular">{item.quantity}</span>
                  <Button size="sm" variant="outline" className="h-7 w-7 border-[#173C32]/20 p-0" onClick={() => changeQty(item.productId, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <span className="w-20 text-right text-sm font-semibold tabular" style={{ color: "#173C32" }}>
                  {formatMoney(item.quantity * item.priceMinor, currency, locale)}
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#173C32]/40" onClick={() => changeQty(item.productId, -item.quantity)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-[#173C32]/10 pt-3 text-base font-semibold" style={{ color: "#173C32" }}>
            <span style={{ fontFamily: SERIF }}>{locale === "pt" ? "Total" : "Total"}</span>
            <span className="tabular" style={{ color: "#C6A66B" }}>{formatMoney(basketTotal, currency, locale)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[#173C32]/30 text-[#173C32]" onClick={() => setBasketOpen(false)}>
              {locale === "pt" ? "Continuar" : "Continue"}
            </Button>
            <Button onClick={submitOrder} disabled={submitting} className="text-white" style={{ background: "#173C32" }}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              {locale === "pt" ? "Confirmar encomenda" : "Confirm order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DishCard({
  product: p,
  currency,
  locale,
  onAdd,
}: {
  product: MenuProduct;
  currency: string;
  locale: "pt" | "en";
  onAdd: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#173C32]/8 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F7F3EA]">
        {p.imageUrl && !imgError ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: "linear-gradient(135deg, #173C32, #102B25)" }}>
            <span className="text-3xl font-medium" style={{ fontFamily: SERIF, color: "#C6A66B" }}>M</span>
          </div>
        )}
        {p.featured && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm" style={{ background: "#C6A66B" }}>
            <Sparkles className="h-3 w-3" />
            {locale === "pt" ? "Assinatura" : "Signature"}
          </div>
        )}
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h4 className="text-lg font-medium leading-snug" style={{ fontFamily: SERIF, color: "#173C32" }}>
          {p.name}
        </h4>
        {p.nameEn && (
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[#173C32]/40">
            {p.nameEn}
          </p>
        )}
        {p.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#173C32]/65">
            {locale === "en" && p.descriptionEn ? p.descriptionEn : p.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-semibold tabular" style={{ color: "#C6A66B" }}>
            {formatMoney(p.priceMinor, currency, locale)}
          </span>
          <Button
            size="sm"
            onClick={onAdd}
            className="h-9 w-9 rounded-full p-0 text-white transition-transform hover:scale-105"
            style={{ background: "#173C32" }}
            aria-label={`Adicionar ${p.name}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
