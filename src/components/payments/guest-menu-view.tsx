"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

/**
 * Guest menu view — fetches the restaurant's menu via the token-gated API
 * (GET /api/menu?tableToken=<opaque>) and displays it mobile-first with
 * category tabs + product cards. Branded via the parent's CSS variables.
 */
export function GuestMenuView({
  tableToken,
  currency,
  locale,
}: {
  tableToken: string;
  currency: string;
  locale: "pt" | "en";
}) {
  const [categories, setCategories] = useState<MenuCategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
    ? active.products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      )
    : active.products;

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
            onClick={() => {
              setActiveCat(c.id);
              setQuery("");
            }}
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
          filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3"
            >
              {p.imageUrl && (
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                {p.description && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular">
                {formatMoney(p.priceMinor, currency, locale)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
