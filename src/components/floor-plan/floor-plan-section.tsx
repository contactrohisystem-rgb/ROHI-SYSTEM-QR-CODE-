"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";
import type { TableQrView } from "@/components/tables/table-card";
import { BillManager } from "@/components/billing/bill-manager";

type FloorStatus = {
  label: string;
  ring: string; // border/ring color
  surface: string; // table surface bg
  dot: string;
};

function floorStatus(t: TableQrView): FloorStatus {
  if (t.activeBill?.hasPendingPayment)
    return {
      label: "A aguardar pagamento",
      ring: "ring-[oklch(0.7_0.15_65/0.5)]",
      surface: "bg-[oklch(0.7_0.15_65/0.18)]",
      dot: "bg-[oklch(0.7_0.15_65)]",
    };
  if (t.activeBill)
    return {
      label: "Conta aberta",
      ring: "ring-primary/50",
      surface: "bg-primary/15",
      dot: "bg-primary",
    };
  if (t.status === "RESERVED")
    return {
      label: "Reservada",
      ring: "ring-[oklch(0.7_0.15_65/0.4)]",
      surface: "bg-muted",
      dot: "bg-[oklch(0.7_0.15_65)]",
    };
  if (t.status === "OCCUPIED")
    return {
      label: "Ocupada",
      ring: "ring-border",
      surface: "bg-muted",
      dot: "bg-muted-foreground",
    };
  return {
    label: "Disponível",
    ring: "ring-primary/30",
    surface: "bg-card",
    dot: "bg-primary/60",
  };
}

const SHAPE_SIZE: Record<string, { w: number; h: number; radius: string }> = {
  round: { w: 64, h: 64, radius: "9999px" },
  square: { w: 54, h: 54, radius: "10px" },
  rect: { w: 92, h: 54, radius: "12px" },
  booth: { w: 84, h: 58, radius: "18px" },
};

function TableNode({
  table,
  selected,
  dragging,
  livePos,
  onSelect,
  onPointerDown,
}: {
  table: TableQrView;
  selected: boolean;
  dragging: boolean;
  livePos: { posX: number; posY: number } | null;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const st = floorStatus(table);
  const size = SHAPE_SIZE[table.shape] ?? SHAPE_SIZE.round;
  const posX = livePos?.posX ?? table.posX;
  const posY = livePos?.posY ?? table.posY;
  const seats = table.seats;

  return (
    <div
      className="absolute touch-none select-none"
      style={{
        left: `${posX}%`,
        top: `${posY}%`,
        transform: "translate(-50%, -50%)",
        zIndex: selected || dragging ? 30 : 10,
        cursor: dragging ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        if (!dragging) onSelect();
      }}
    >
      <div className="relative flex items-center justify-center">
        {/* chairs ring */}
        {Array.from({ length: seats }).map((_, i) => {
          const angle = (i / seats) * Math.PI * 2;
          const rx = size.w / 2 + 12;
          const ry = size.h / 2 + 12;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          return (
            <span
              key={i}
              className="absolute h-3 w-3 rounded-sm bg-muted-foreground/40"
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              aria-hidden="true"
            />
          );
        })}
        {/* table surface */}
        <div
          className={`flex items-center justify-center ring-2 ${st.ring} ${st.surface} text-foreground shadow-lg transition-shadow ${
            selected ? "shadow-xl ring-primary" : ""
          }`}
          style={{
            width: size.w,
            height: size.h,
            borderRadius: size.radius,
            backgroundImage:
              "linear-gradient(135deg, oklch(1 0 0 / 6%), oklch(0 0 0 / 8%))",
          }}
        >
          <span className="text-[11px] font-semibold tabular">
            {table.label.replace(/^Mesa\s+/i, "")}
          </span>
        </div>
        {/* status dot */}
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${st.dot}`}
        />
      </div>
      {/* label below */}
      <div className="mt-1 text-center text-[10px] font-medium text-muted-foreground">
        {table.label}
      </div>
    </div>
  );
}

export function FloorPlanSection({
  tables,
  canManage,
}: {
  tables: TableQrView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    origPosX: number;
    origPosY: number;
  } | null>(null);
  const dragPosRef = useRef<{ posX: number; posY: number } | null>(null);
  const [dragRender, setDragRender] = useState<{
    id: string;
    posX: number;
    posY: number;
  } | null>(null);

  // areas derived from tables
  const areas = Array.from(new Set(tables.map((t) => t.area ?? "Geral")));
  const [activeArea, setActiveArea] = useState(areas[0] ?? "Geral");
  const areaTables = tables.filter((t) => (t.area ?? "Geral") === activeArea);

  const selected = tables.find((t) => t.id === selectedId) ?? null;

  // bill manager for the selected table
  const [billOpen, setBillOpen] = useState(false);

  // add/edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TableQrView | null>(null);
  const [form, setForm] = useState({ label: "", area: "", shape: "round", seats: "4" });
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // drag listeners
  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragging.startY) / rect.height) * 100;
      const posX = Math.max(6, Math.min(94, dragging.origPosX + dxPct));
      const posY = Math.max(8, Math.min(92, dragging.origPosY + dyPct));
      dragPosRef.current = { posX, posY };
      setDragRender({ id: dragging.id, posX, posY });
    }
    async function onUp() {
      const pos = dragPosRef.current;
      if (pos) {
        await fetch(`/api/tables/${dragging.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posX: pos.posX, posY: pos.posY }),
        });
        router.refresh();
      }
      setDragging(null);
      setDragRender(null);
      dragPosRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, router]);

  function startDrag(e: React.PointerEvent, t: TableQrView) {
    if (!canManage) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(t.id);
    setDragging({
      id: t.id,
      startX: e.clientX,
      startY: e.clientY,
      origPosX: t.posX,
      origPosY: t.posY,
    });
    dragPosRef.current = { posX: t.posX, posY: t.posY };
  }

  function openAdd() {
    setEditing(null);
    setForm({ label: "", area: activeArea, shape: "round", seats: "4" });
    setEditOpen(true);
  }
  function openEdit(t: TableQrView) {
    setEditing(t);
    setForm({
      label: t.label,
      area: t.area ?? "",
      shape: t.shape,
      seats: String(t.seats),
    });
    setEditOpen(true);
  }

  async function saveTable() {
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/tables/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            area: form.area || null,
            shape: form.shape,
            seats: Number(form.seats) || 4,
          }),
        });
        if (!res.ok) throw new Error();
        toast({ title: "Mesa actualizada" });
      } else {
        const res = await fetch("/api/tables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            area: form.area || null,
            shape: form.shape,
            seats: Number(form.seats) || 4,
            posX: 50,
            posY: 50,
          }),
        });
        if (!res.ok) throw new Error();
        toast({ title: "Mesa criada" });
      }
      setEditOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable() {
    if (!selected) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tables/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "table_has_bills") {
          toast({
            title: "Não é possível eliminar",
            description: "Esta mesa tem contas associadas.",
            variant: "destructive",
          });
        } else throw new Error();
      } else {
        toast({ title: "Mesa eliminada" });
        setSelectedId(null);
        router.refresh();
      }
    } catch {
      toast({ title: "Erro ao eliminar", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Area switcher + add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveArea(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeArea === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova mesa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Floor */}
        <Card className="overflow-hidden lg:col-span-2">
          <div
            ref={containerRef}
            className="relative h-[420px] w-full touch-none select-none bg-[radial-gradient(circle,oklch(1_0_0/5%)_1px,transparent_1px)] [background-size:22px_22px] lg:h-[480px]"
            onPointerDown={() => setSelectedId(null)}
          >
            {areaTables.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem mesas nesta área
              </div>
            ) : (
              areaTables.map((t) => (
                <TableNode
                  key={t.id}
                  table={t}
                  selected={selectedId === t.id}
                  dragging={dragging?.id === t.id}
                  livePos={dragRender?.id === t.id ? dragRender : null}
                  onSelect={() => setSelectedId(t.id)}
                  onPointerDown={(e) => startDrag(e, t)}
                />
              ))
            )}
            {/* area label */}
            <div className="pointer-events-none absolute left-4 top-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {activeArea}
              <span className="ml-1 text-muted-foreground/60">
                · {areaTables.length} mesas
              </span>
            </div>
          </div>
        </Card>

        {/* Details panel */}
        <Card className="h-fit">
          <CardContent className="p-5">
            {!selected ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Armchair className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Seleccione uma mesa</p>
                <p className="max-w-[16rem] text-xs text-muted-foreground">
                  Clique numa mesa para ver o estado, abrir a conta ou gerir o
                  QR. {canManage ? "Arraste para reposicionar." : ""}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{selected.label}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {selected.area ?? "Geral"}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${floorStatus(selected).surface} ${floorStatus(selected).dot.replace("bg-", "text-")}`}
                  >
                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${floorStatus(selected).dot}`} />
                    {floorStatus(selected).label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Capacidade
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 font-medium">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {selected.seats}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Forma
                    </div>
                    <div className="mt-0.5 font-medium capitalize">
                      {selected.shape}
                    </div>
                  </div>
                  {selected.activeBill && (
                    <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Conta aberta
                        </span>
                        <span className="text-sm font-semibold tabular text-primary">
                          {formatMoney(
                            selected.activeBill.totalMinor,
                            selected.activeBill.currency,
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => setBillOpen(true)}
                    disabled={!selected.activeBill}
                  >
                    <Receipt className="mr-1.5 h-4 w-4" /> Ver conta
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href={selected.payUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Ver página
                    </a>
                  </Button>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(selected)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:text-destructive"
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Eliminar {selected.label}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acção não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={deleteTable}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* legend */}
                <div className="space-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary/60" /> Disponível
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Conta aberta
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[oklch(0.7_0.15_65)]" />{" "}
                    A aguardar / reservada
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Ocupada
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar mesa" : "Nova mesa"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere o identificador, área, forma e capacidade."
                : "Adicione uma mesa ao plano. O QR é gerado automaticamente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fp-label">Identificador</Label>
              <Input
                id="fp-label"
                placeholder="Mesa 8"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fp-area">Área</Label>
                <Input
                  id="fp-area"
                  placeholder="Interior"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-seats">Capacidade</Label>
                <Input
                  id="fp-seats"
                  type="number"
                  min={1}
                  max={20}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma</Label>
              <Select
                value={form.shape}
                onValueChange={(v) => setForm({ ...form, shape: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Redonda</SelectItem>
                  <SelectItem value="square">Quadrada</SelectItem>
                  <SelectItem value="rect">Rectangular</SelectItem>
                  <SelectItem value="booth">Banca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={saveTable} disabled={saving || !form.label}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill manager for the selected table */}
      {selected && (
        <BillManager
          tableId={selected.id}
          tableName={selected.label}
          open={billOpen}
          onOpenChange={(v) => {
            setBillOpen(v);
            if (!v) router.refresh();
          }}
          canVoid={canManage}
        />
      )}
    </div>
  );
}
