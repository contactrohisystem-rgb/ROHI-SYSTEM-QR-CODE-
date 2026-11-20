"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

export interface TransactionView {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  providerCode: string;
  tableLabel: string | null;
  confirmedAt: string | null;
  createdAt: string;
  posSyncStatus: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  MOCK: "M-Pesa (Demo)",
  MPESA: "M-Pesa",
  EMOLA: "e-Mola",
  CARD: "Card",
};

const STATUS_STYLE: Record<string, string> = {
  SUCCEEDED: "bg-primary/12 text-primary",
  INITIATED: "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]",
  PENDING: "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]",
  FAILED: "bg-destructive/12 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted text-muted-foreground",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  SUCCEEDED: CheckCircle2,
  INITIATED: Clock,
  PENDING: Clock,
  FAILED: XCircle,
  CANCELLED: XCircle,
  REFUNDED: AlertCircle,
};

const STATUS_LABEL_PT: Record<string, string> = {
  SUCCEEDED: "Bem-sucedido",
  INITIATED: "Iniciado",
  PENDING: "Pendente",
  FAILED: "Falhado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

type FilterId =
  | "all"
  | "succeeded"
  | "pending"
  | "failed"
  | "cancelled"
  | "pos_failed";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "succeeded", label: "Bem-sucedidas" },
  { id: "pending", label: "Pendentes" },
  { id: "failed", label: "Falhadas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "pos_failed", label: "POS: falhou" },
];

function matches(tx: TransactionView, f: FilterId): boolean {
  switch (f) {
    case "succeeded":
      return tx.status === "SUCCEEDED";
    case "pending":
      return tx.status === "INITIATED" || tx.status === "PENDING";
    case "failed":
      return tx.status === "FAILED";
    case "cancelled":
      return tx.status === "CANCELLED";
    case "pos_failed":
      return tx.posSyncStatus === "FAILED";
    default:
      return true;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PosSyncBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-muted-foreground">—</span>;
  const cls =
    status === "SUCCEEDED"
      ? "bg-primary/12 text-primary"
      : status === "FAILED"
        ? "bg-destructive/12 text-destructive"
        : "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]";
  return <Badge variant="secondary" className={`text-[10px] ${cls}`}>POS: {status}</Badge>;
}

export function PaymentsSection({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [selected, setSelected] = useState<TransactionView | null>(null);

  const filtered = transactions.filter((tx) => matches(tx, filter));
  const counts: Record<FilterId, number> = {
    all: transactions.length,
    succeeded: transactions.filter((t) => matches(t, "succeeded")).length,
    pending: transactions.filter((t) => matches(t, "pending")).length,
    failed: transactions.filter((t) => matches(t, "failed")).length,
    cancelled: transactions.filter((t) => matches(t, "cancelled")).length,
    pos_failed: transactions.filter((t) => matches(t, "pos_failed")).length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pagamentos</h2>
        <p className="text-sm text-muted-foreground">
          Histórico de transacções e estado de sincronização com o POS
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Sem transacções neste filtro
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((tx) => {
                const SIcon = STATUS_ICON[tx.status] ?? Clock;
                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelected(tx)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 lg:px-6"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        STATUS_STYLE[tx.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      <SIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {tx.tableLabel ?? "—"}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          {METHOD_LABEL[tx.providerCode] ?? tx.providerCode}
                        </Badge>
                      </div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {tx.id.slice(0, 14)}
                      </div>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      {fmtDate(tx.confirmedAt ?? tx.createdAt)}
                      <div className="mt-1">
                        <PosSyncBadge status={tx.posSyncStatus} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular">
                        {formatMoney(tx.amountMinor, tx.currency)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {STATUS_LABEL_PT[tx.status] ?? tx.status}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da transacção</DialogTitle>
            <DialogDescription className="font-mono">
              {selected?.id}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="text-lg font-semibold tabular">
                  {formatMoney(selected.amountMinor, selected.currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Mesa
                  </div>
                  <div className="font-medium">{selected.tableLabel ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Método
                  </div>
                  <div className="font-medium">
                    {METHOD_LABEL[selected.providerCode] ?? selected.providerCode}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Estado do pagamento
                  </div>
                  <Badge variant="secondary" className={STATUS_STYLE[selected.status] ?? ""}>
                    {STATUS_LABEL_PT[selected.status] ?? selected.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Sincronização POS
                  </div>
                  <PosSyncBadge status={selected.posSyncStatus} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Criado
                  </div>
                  <div className="text-xs">{fmtDate(selected.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Confirmado
                  </div>
                  <div className="text-xs">{fmtDate(selected.confirmedAt)}</div>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  O estado do pagamento é independente da sincronização com o
                  POS. Um pagamento bem-sucedido permanece bem-sucedido mesmo
                  que a sincronização com o POS falhe ou esteja a repetir.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
