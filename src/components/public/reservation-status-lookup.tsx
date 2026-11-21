"use client";

import { useState } from "react";
import { CalendarCheck, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Props {
  slug: string;
}

interface LookupResult {
  reservation: {
    reference: string;
    customerName: string;
    partySize: number;
    date: string;
    durationMins: number;
    areaPreference: string | null;
    notes: string | null;
    status: string;
    tableLabel: string | null;
    tableArea: string | null;
  };
  restaurant: { name: string; slug: string; address: string | null; phone: string | null };
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-amber-500/15 text-amber-600" },
  CONFIRMED: { label: "Confirmada", cls: "bg-primary/12 text-primary" },
  SEATED: { label: "Sentado", cls: "bg-green-600/15 text-green-600" },
  COMPLETED: { label: "Concluída", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  NO_SHOW: { label: "No-show", cls: "bg-destructive/12 text-destructive" },
};

/**
 * Public reservation status lookup + cancellation (Stage 13A).
 * The booking reference is the guest's credential — no auth required.
 */
export function ReservationStatusLookup({ slug }: Props) {
  const { toast } = useToast();
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function lookup() {
    if (!reference.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/reservations/lookup?reference=${encodeURIComponent(reference.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        toast({ title: "Reserva não encontrada", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    if (!result) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/reservations/lookup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: result.reservation.reference }),
      });
      if (res.ok) {
        toast({ title: "Reserva cancelada" });
        setResult(null);
        setReference("");
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.message ?? "Não foi possível cancelar", variant: "destructive" });
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Consultar reserva</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="RSV-XXXXXX"
            className="h-10 font-mono uppercase"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <Button onClick={lookup} disabled={loading || !reference.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Introduza a referência recebida na confirmação.
        </p>
      </div>

      {result && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">{result.reservation.reference}</span>
              <Badge variant="secondary" className={STATUS_LABEL[result.reservation.status]?.cls ?? ""}>
                {STATUS_LABEL[result.reservation.status]?.label ?? result.reservation.status}
              </Badge>
            </div>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span>{result.reservation.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span>{new Date(result.reservation.date).toLocaleString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pessoas</span>
              <span>{result.reservation.partySize}</span>
            </div>
            {result.reservation.tableLabel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mesa</span>
                <span>{result.reservation.tableLabel}{result.reservation.tableArea ? ` · ${result.reservation.tableArea}` : ""}</span>
              </div>
            )}
            {result.reservation.areaPreference && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área</span>
                <span>{result.reservation.areaPreference}</span>
              </div>
            )}
            {result.reservation.notes && (
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
                {result.reservation.notes}
              </div>
            )}
          </div>
          {(result.reservation.status === "PENDING" || result.reservation.status === "CONFIRMED") && (
            <div className="border-t border-border/60 px-4 py-3">
              <Button variant="outline" className="w-full text-destructive" onClick={cancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}
                Cancelar reserva
              </Button>
            </div>
          )}
        </div>
      )}

      <a
        href={`/r/${encodeURIComponent(slug)}`}
        className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <CalendarCheck className="h-3.5 w-3.5" /> Fazer nova reserva
      </a>
    </div>
  );
}
