"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  RotateCw,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface PosConnectionView {
  id: string;
  adapterCode: string;
  status: string;
  lastError: string | null;
  lastSyncAt: string | null;
}
interface SyncRecordView {
  id: string;
  direction: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  externalResourceId: string | null;
  bill: { id: string; externalPosBillId: string | null } | null;
}
interface TableView {
  id: string;
  label: string;
  hasOpenBill: boolean;
}

const DIRECTION_LABEL: Record<string, string> = {
  BILL_FETCH: "Factura (entrada)",
  PAYMENT_CONFIRM: "Confirmação (saída)",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SUCCEEDED: "default",
  RETRYING: "outline",
  PENDING: "secondary",
  FAILED: "destructive",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "agora";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 0) return `em ${mins}m ${secs}s`;
  return `em ${secs}s`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * POS dashboard section. Shows the restaurant's POS connection, recent sync
 * records (with retry state), and demo controls (enable mock POS, simulate a
 * POS bill fetch, simulate a POS outage to observe retry/backoff).
 */
export function PosSection({ tables }: { tables: TableView[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [connection, setConnection] = useState<PosConnectionView | null>(null);
  const [records, setRecords] = useState<SyncRecordView[]>([]);
  const [simFailure, setSimFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processLoading, setProcessLoading] = useState(false);
  const [enableLoading, setEnableLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>("");

  const availableTables = tables.filter((t) => !t.hasOpenBill);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, f] = await Promise.all([
        fetch("/api/pos/connection").then((x) => x.json()),
        fetch("/api/pos/sync-records").then((x) => x.json()),
        fetch("/api/pos/mock/simulate-failure").then((x) => x.json()),
      ]);
      setConnection(c.connection ?? null);
      setRecords(r.records ?? []);
      setSimFailure(f.simulatedFailure ?? false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enableMockPos() {
    setEnableLoading(true);
    try {
      const res = await fetch("/api/pos/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapterCode: "MOCK" }),
      });
      if (res.ok) {
        toast({ title: "POS mock activado" });
        await load();
      }
    } finally {
      setEnableLoading(false);
    }
  }

  async function processSyncs() {
    setProcessLoading(true);
    try {
      const res = await fetch("/api/pos/sync/process", { method: "POST" });
      const data = await res.json();
      toast({ title: `${data.attempted ?? 0} sincronização(ões) processada(s)` });
      await load();
    } finally {
      setProcessLoading(false);
    }
  }

  async function simulatePosBill() {
    if (!selectedTable) return;
    setFetchLoading(true);
    try {
      const res = await fetch("/api/pos/mock/fetch-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: selectedTable }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "table_has_open_bill") {
          toast({
            title: "Mesa ocupada",
            description: "Esta mesa já tem uma conta aberta.",
            variant: "destructive",
          });
        } else {
          throw new Error(d.error || "Erro");
        }
      } else {
        toast({ title: "Factura POS recebida" });
        setSelectedTable("");
        await load();
        router.refresh();
      }
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setFetchLoading(false);
    }
  }

  async function toggleSimFailure(enabled: boolean) {
    setSimFailure(enabled);
    await fetch("/api/pos/mock/simulate-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    toast({
      title: enabled
        ? "Falha POS simulada — sincronizações vão falhar e repetir"
        : "Falha POS desactivada",
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integração POS</h2>
        <p className="text-sm text-muted-foreground">
          Sincronização de facturas e confirmações de pagamento com o POS
        </p>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {connection && connection.adapterCode !== "NONE" ? (
                <PlugZap className="h-4 w-4" />
              ) : (
                <Plug className="h-4 w-4 text-muted-foreground" />
              )}
              {connection && connection.adapterCode !== "NONE"
                ? `Adaptador: ${connection.adapterCode}`
                : "Sem POS configurado"}
            </CardTitle>
            <CardDescription>
              {connection && connection.adapterCode !== "NONE"
                ? `Última sincronização: ${formatDateTime(connection.lastSyncAt)}`
                : "Active um adaptador para sincronizar com o POS."}
            </CardDescription>
          </div>
          {connection && connection.adapterCode !== "NONE" ? (
            <Badge variant={connection.status === "ACTIVE" ? "default" : "destructive"}>
              {connection.status}
            </Badge>
          ) : (
            <Button size="sm" onClick={enableMockPos} disabled={enableLoading}>
              {enableLoading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plug className="mr-1 h-3.5 w-3.5" />
              )}
              Activar POS mock
            </Button>
          )}
        </CardHeader>
        {connection?.lastError && (
          <CardContent>
            <p className="text-xs text-destructive">
              Último erro: {connection.lastError}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Sync records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Registos de sincronização</CardTitle>
            <CardDescription>
              Facturas recebidas e confirmações enviadas ao POS
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={processSyncs}
            disabled={processLoading}
          >
            {processLoading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Processar pendentes
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem registos de sincronização.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {DIRECTION_LABEL[r.direction] ?? r.direction}
                      </span>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tentativas: {r.attempts}/{r.maxAttempts}
                      {r.lastError ? ` · ${r.lastError}` : ""}
                    </div>
                    {r.status === "RETRYING" && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <RotateCw className="h-3 w-3" />
                        Próxima tentativa {relativeTime(r.nextAttemptAt)}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {formatDateTime(r.lastAttemptAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo controls */}
      {connection && connection.adapterCode !== "NONE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demonstração POS</CardTitle>
            <CardDescription>
              Simular factura do POS e falha de sincronização (demonstração)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Simular factura recebida do POS</Label>
              <div className="flex gap-2">
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar mesa disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        Sem mesas disponíveis
                      </SelectItem>
                    ) : (
                      availableTables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={simulatePosBill}
                  disabled={fetchLoading || !selectedTable || selectedTable === "_none"}
                >
                  {fetchLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Simular falha do POS</div>
                <div className="text-xs text-muted-foreground">
                  As confirmações vão falhar e repetir com backoff.
                </div>
              </div>
              <Switch
                checked={simFailure}
                onCheckedChange={toggleSimFailure}
                aria-label="Simular falha do POS"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
