"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  Phone,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";

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

interface TableView {
  id: string;
  label: string;
  area: string | null;
  seats: number;
  status: string;
}
interface ReservationView {
  id: string;
  customerName: string;
  phone: string;
  partySize: number;
  date: string;
  durationMins: number;
  areaPreference: string | null;
  notes: string | null;
  status: string;
  table: { id: string; label: string } | null;
  reference?: string | null;
}

const STATUS_CFG: Record<
  string,
  { label: string; cls: string; icon: typeof Clock }
> = {
  PENDING: { label: "Pendente", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  CONFIRMED: { label: "Confirmada", cls: "bg-primary/12 text-primary", icon: Check },
  SEATED: { label: "Sentado", cls: "bg-green-600/15 text-green-600 dark:text-green-400", icon: LogIn },
  COMPLETED: { label: "Concluída", cls: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelada", cls: "bg-muted text-muted-foreground", icon: X },
  NO_SHOW: { label: "No-show", cls: "bg-destructive/12 text-destructive", icon: XCircle },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isUpcoming(iso: string): boolean {
  return new Date(iso).getTime() >= Date.now() - 60 * 60 * 1000;
}

export function ReservationsSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<ReservationView[]>([]);
  const [tables, setTables] = useState<TableView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("UPCOMING");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Assign-table dialog state
  const [assignTarget, setAssignTarget] = useState<ReservationView | null>(null);
  const [assignTableId, setAssignTableId] = useState<string>("");
  // Reschedule dialog state (Stage 13C: staff proposes alternative time)
  const [rescheduleTarget, setRescheduleTarget] = useState<ReservationView | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("20:00");

  const load = async () => {
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/reservations"),
        fetch("/api/tables"),
      ]);
      if (rRes.ok) {
        const d = await rRes.json();
        setReservations(d.reservations ?? []);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        setTables(d.tables ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function update(id: string, payload: Record<string, unknown>, label: string) {
    setActionLoading(id + label);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: label });
        await load();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: d.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  }

  function openAssign(r: ReservationView) {
    setAssignTarget(r);
    setAssignTableId(r.table?.id ?? "");
  }

  async function confirmAssign() {
    if (!assignTarget || !assignTableId) return;
    await update(
      assignTarget.id,
      { status: "CONFIRMED", tableId: assignTableId },
      "Confirmada",
    );
    setAssignTarget(null);
  }

  function openReschedule(r: ReservationView) {
    setRescheduleTarget(r);
    const d = new Date(r.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    setRescheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setRescheduleTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  async function confirmReschedule() {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    const iso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    await update(
      rescheduleTarget.id,
      { newDate: iso },
      "Horário alterado",
    );
    setRescheduleTarget(null);
  }

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  // Filtering by status tab + search query (name or phone).
  const q = searchQuery.trim().toLowerCase();
  const filtered = reservations.filter((r) => {
    if (filter === "UPCOMING") {
      if (!(isUpcoming(r.date) && r.status !== "COMPLETED" && r.status !== "CANCELLED" && r.status !== "NO_SHOW")) return false;
    } else if (filter === "PENDING") {
      if (r.status !== "PENDING") return false;
    } else if (filter === "CONFIRMED") {
      if (r.status !== "CONFIRMED") return false;
    } else if (filter === "SEATED") {
      if (r.status !== "SEATED") return false;
    } else if (filter === "PAST") {
      if (!(r.status === "COMPLETED" || r.status === "CANCELLED" || r.status === "NO_SHOW")) return false;
    }
    if (q) {
      return r.customerName.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q) || (r.reference ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = reservations.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Reservas</h2>
          <p className="text-sm text-muted-foreground">
            Gestão de reservas · actualiza a cada 15s
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Procurar por nome, telefone ou referência..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >Lista</button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >Semana</button>
        </div>
      </div>
      {viewMode === "list" && (
        <div className="flex flex-wrap gap-1.5">
          {[
            ["UPCOMING", "Próximas"],
            ["PENDING", "Pendentes"],
            ["CONFIRMED", "Confirmadas"],
            ["SEATED", "Sentados"],
            ["PAST", "Histórico"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Weekly calendar view (Stage 13C) */}
      {viewMode === "week" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const start = new Date(today);
                start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                return `${start.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}`;
              })()}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7);
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + i);
              return d;
            });
            const q = searchQuery.trim().toLowerCase();
            return (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                {days.map((d) => {
                  const dayEnd = new Date(d);
                  dayEnd.setHours(23, 59, 59, 999);
                  const dayRes = reservations.filter((r) => {
                    const rd = new Date(r.date);
                    if (rd < d || rd > dayEnd) return false;
                    if (q && !(r.customerName.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q))) return false;
                    return true;
                  });
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={d.toISOString()} className={`rounded-lg border p-2 ${isToday ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium">{d.toLocaleDateString("pt-PT", { weekday: "short" })}</span>
                        <span className={`text-xs tabular ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{d.getDate()}</span>
                      </div>
                      <div className="space-y-1">
                        {dayRes.length === 0 ? (
                          <p className="py-2 text-center text-[10px] text-muted-foreground/60">—</p>
                        ) : dayRes.map((r) => {
                          const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.PENDING;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => { setFilter("UPCOMING"); setViewMode("list"); }}
                              className="block w-full rounded-md border border-border/50 bg-card px-2 py-1 text-left text-[10px] hover:border-primary/40"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{new Date(r.date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className={cfg.cls + " rounded px-1 text-[9px]"}>{cfg.label}</span>
                              </div>
                              <div className="truncate text-muted-foreground">{r.customerName} · {r.partySize}p</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10">
            <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Sem reservas nesta vista.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.PENDING;
            const SIcon = cfg.icon;
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.customerName}</span>
                        <Badge variant="secondary" className={cfg.cls}>
                          <SIcon className="mr-1 h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {r.table && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.table.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDateTime(r.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {r.partySize} pax
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {r.durationMins}min
                        </span>
                        {r.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {r.phone}
                          </span>
                        )}
                      </div>
                      {r.areaPreference && (
                        <p className="text-xs text-muted-foreground">
                          Preferência: {r.areaPreference}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-xs italic text-muted-foreground">
                          {r.notes}
                        </p>
                      )}
                    </div>

                    {/* Action buttons by status */}
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === "PENDING" && (
                        <>
                          <Button size="sm" onClick={() => openAssign(r)} disabled={!!actionLoading}>
                            {actionLoading === r.id + "Confirmada" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                            Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReschedule(r)} disabled={!!actionLoading}>
                            <Clock className="mr-1 h-3.5 w-3.5" />Reagendar
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => update(r.id, { status: "CANCELLED" }, "Cancelada")} disabled={!!actionLoading}>
                            <X className="mr-1 h-3.5 w-3.5" />Rejeitar
                          </Button>
                        </>
                      )}
                      {r.status === "CONFIRMED" && (
                        <>
                          <Button size="sm" onClick={() => update(r.id, { status: "SEATED" }, "Sentado")} disabled={!!actionLoading}>
                            {actionLoading === r.id + "Sentado" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1 h-3.5 w-3.5" />}
                            Sentar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openAssign(r)} disabled={!!actionLoading}>
                            Trocar mesa
                          </Button>
                        </>
                      )}
                      {r.status === "SEATED" && (
                        <>
                          <Button size="sm" onClick={() => update(r.id, { status: "COMPLETED" }, "Concluída")} disabled={!!actionLoading}>
                            {actionLoading === r.id + "Concluída" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                            Concluir
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => update(r.id, { status: "NO_SHOW" }, "No-show")} disabled={!!actionLoading}>
                            <XCircle className="mr-1 h-3.5 w-3.5" />No-show
                          </Button>
                        </>
                      )}
                      {(r.status === "CONFIRMED" || r.status === "SEATED") && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => update(r.id, { status: "CANCELLED" }, "Cancelada")} disabled={!!actionLoading}>
                          Cancelar
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

      {/* Assign-table dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir mesa</DialogTitle>
            <DialogDescription>
              {assignTarget ? `Confirmar reserva de ${assignTarget.customerName} (${assignTarget.partySize} pax)` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="assign-table">Mesa</Label>
            <Select value={assignTableId} onValueChange={setAssignTableId}>
              <SelectTrigger id="assign-table">
                <SelectValue placeholder="Escolha uma mesa" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} · {t.seats} lugares {t.area ? `· ${t.area}` : ""} ({t.status === "AVAILABLE" ? "livre" : t.status === "OCCUPIED" ? "ocupada" : "reservada"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tables.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma mesa disponível.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancelar</Button>
            <Button onClick={confirmAssign} disabled={!assignTableId || !!actionLoading}>
              {actionLoading === (assignTarget?.id ?? "") + "Confirmada" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Confirmar reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog (Stage 13C: propose alternative time) */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(o) => !o && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar reserva</DialogTitle>
            <DialogDescription>
              {rescheduleTarget ? `${rescheduleTarget.customerName} · ${rescheduleTarget.partySize} pax` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rsh-date" className="text-xs">Nova data</Label>
              <Input id="rsh-date" type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsh-time" className="text-xs">Nova hora</Label>
              <Input id="rsh-time" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>Cancelar</Button>
            <Button onClick={confirmReschedule} disabled={!rescheduleDate || !rescheduleTime || !!actionLoading}>
              {actionLoading === (rescheduleTarget?.id ?? "") + "Horário alterado" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Clock className="mr-1.5 h-4 w-4" />}
              Alterar horário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
