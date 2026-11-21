"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Wallet,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/**
 * Staff cash management panel. Shows pending cash payments awaiting collection
 * and lets authorised staff (SERVER+) confirm collection: enter amount
 * received → server calculates change → payment transitions to PAID.
 *
 * Dine-in cash and COD are both supported (collectionType). The confirm action
 * calls POST /api/payments/cash/collect which is transactional and idempotent.
 */
interface PendingCashPayment {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  bill: {
    id: string;
    tableId: string | null;
    table: { label: string } | null;
    items: { name: string; quantity: number; totalMinor: number }[];
  } | null;
  cashCollection: unknown;
}

export function CashManagementSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [payments, setPayments] = useState<PendingCashPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectTarget, setCollectTarget] = useState<PendingCashPayment | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/payments/cash/pending");
      if (res.ok) {
        const d = await res.json();
        setPayments(d.payments ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  function openCollect(p: PendingCashPayment) {
    setCollectTarget(p);
    // Default to exact amount.
    setAmountReceived(String((p.amountMinor / 100).toFixed(2)));
  }

  async function confirmCollect() {
    if (!collectTarget) return;
    const receivedMinor = Math.round(parseFloat(amountReceived || "0") * 100);
    if (Number.isNaN(receivedMinor) || receivedMinor < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/payments/cash/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: collectTarget.id,
          amountReceivedMinor: receivedMinor,
          collectionType: "DINE_IN",
        }),
      });
      const d = await res.json();
      if (res.ok) {
        const change = d.collection?.changeMinor ?? 0;
        toast({
          title: "Cobrança confirmada",
          description: change > 0 ? `Troco: ${formatMoney(change, d.collection.currency)}` : undefined,
        });
        setCollectTarget(null);
        await load();
        router.refresh();
      } else {
        toast({ title: d.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setConfirming(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const receivedMinor = Math.round(parseFloat(amountReceived || "0") * 100);
  const changeMinor = collectTarget ? receivedMinor - collectTarget.amountMinor : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestão de Numerário</h2>
          <p className="text-sm text-muted-foreground">
            Cobranças pendentes · actualiza a cada 10s
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          {payments.length} pendente{payments.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10">
            <Banknote className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sem cobranças pendentes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 12)}</span>
                      {p.bill?.table && (
                        <Badge variant="outline" className="text-[10px]">{p.bill.table.label}</Badge>
                      )}
                      <Badge variant="secondary" className="bg-amber-500/15 text-amber-600">
                        <Clock className="mr-1 h-3 w-3" />Aguarda cobrança
                      </Badge>
                    </div>
                    {p.bill?.items && (
                      <div className="truncate text-xs text-muted-foreground">
                        {p.bill.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(p.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular text-primary">
                      {formatMoney(p.amountMinor, p.currency)}
                    </div>
                    <Button size="sm" className="mt-1" onClick={() => openCollect(p)}>
                      <Banknote className="mr-1.5 h-3.5 w-3.5" />Cobrar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Collect dialog */}
      <Dialog open={!!collectTarget} onOpenChange={(o) => !o && setCollectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cobrança</DialogTitle>
            <DialogDescription>
              {collectTarget?.bill?.table ? `Mesa ${collectTarget.bill.table.label}` : "Pré-encomenda"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Valor devido</span>
              <span className="font-semibold tabular">
                {collectTarget ? formatMoney(collectTarget.amountMinor, collectTarget.currency) : "—"}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amt-received" className="text-xs">Valor recebido (MZN)</Label>
              <Input
                id="amt-received"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="h-10"
                autoFocus
              />
            </div>
            {collectTarget && !Number.isNaN(receivedMinor) && (
              <div className={`flex justify-between rounded-lg px-3 py-2 text-sm ${changeMinor < 0 ? "bg-destructive/10 text-destructive" : "bg-green-600/10 text-green-600"}`}>
                <span>{changeMinor < 0 ? "Em falta" : "Troco"}</span>
                <span className="font-semibold tabular">{formatMoney(Math.abs(changeMinor), collectTarget.currency)}</span>
              </div>
            )}
            {changeMinor < 0 && (
              <p className="text-xs text-destructive">
                O valor recebido é inferior ao devido. Não é possível confirmar.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectTarget(null)}>Cancelar</Button>
            <Button onClick={confirmCollect} disabled={confirming || changeMinor < 0}>
              {confirming ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Confirmar cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
