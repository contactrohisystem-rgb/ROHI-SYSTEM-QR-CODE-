"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MembershipView } from "@/types/next-auth";

/**
 * Header restaurant switcher. Lists the signed-in user's restaurant
 * memberships; selecting one calls the switch endpoint (sets a cookie) and
 * refreshes — the JWT callback picks up the new active restaurant on the next
 * request, so the whole dashboard re-scopes instantly.
 */
export function RestaurantSwitcher({
  memberships,
  activeId,
}: {
  memberships: MembershipView[];
  activeId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const active = memberships.find((m) => m.id === activeId);

  if (memberships.length === 0) return null;

  async function switchTo(id: string) {
    if (id === activeId) return;
    setLoading(id);
    try {
      const res = await fetch("/api/restaurants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 text-sm font-medium"
        >
          <Store className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[140px] truncate">
            {active?.name ?? "Restaurante"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Restaurantes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => switchTo(m.id)}
            className="gap-2"
          >
            <span className="flex-1 truncate">{m.name}</span>
            {loading === m.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : m.id === activeId ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
