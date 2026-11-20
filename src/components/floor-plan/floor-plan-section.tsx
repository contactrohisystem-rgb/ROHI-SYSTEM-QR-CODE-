"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair,
  Box,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Grid3x3,
  Loader2,
  MapPin,
  Maximize,
  Minus,
  Pencil,
  Plus,
  Receipt,
  RotateCw,
  Trash2,
  Users,
  ZoomIn,
  ZoomOut,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";
import type { TableQrView } from "@/components/tables/table-card";
import { BillManager } from "@/components/billing/bill-manager";

/* ── Status helpers ────────────────────────────────────────────────────── */

function floorStatus(t: TableQrView) {
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

const SHAPE_RADIUS: Record<string, string> = {
  round: "9999px",
  square: "10px",
  rect: "12px",
  booth: "18px",
};

/* ── Table node with resize/rotate handles ─────────────────────────────── */

function TableNode({
  table,
  selected,
  editMode,
  livePos,
  liveSize,
  liveRotation,
  zoom,
  onSelect,
  onPointerDown,
  onResizeStart,
  onRotateStart,
}: {
  table: TableQrView;
  selected: boolean;
  editMode: boolean;
  livePos: { posX: number; posY: number } | null;
  liveSize: { width: number; height: number } | null;
  liveRotation: number | null;
  zoom: number;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
}) {
  const st = floorStatus(table);
  const w = liveSize?.width ?? table.width;
  const h = liveSize?.height ?? table.height;
  const rot = liveRotation ?? table.rotation;
  const posX = livePos?.posX ?? table.posX;
  const posY = livePos?.posY ?? table.posY;
  const seats = table.seats;
  const radius = SHAPE_RADIUS[table.shape] ?? SHAPE_RADIUS.round;

  return (
    <div
      className="absolute touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      style={{
        left: `${posX}%`,
        top: `${posY}%`,
        transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        zIndex: selected ? 30 : 10,
        cursor: editMode ? "grab" : "pointer",
      }}
      role="button"
      tabIndex={0}
      aria-label={`${table.label} — ${st.label}`}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      <div className="relative flex items-center justify-center">
        {/* chairs ring */}
        {Array.from({ length: seats }).map((_, i) => {
          const angle = (i / seats) * Math.PI * 2;
          const rx = w / 2 + 10;
          const ry = h / 2 + 10;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          return (
            <span
              key={i}
              className="absolute h-2.5 w-2.5 rounded-sm bg-muted-foreground/35"
              style={{ transform: `translate(${x}px, ${y}px)` }}
              aria-hidden="true"
            />
          );
        })}
        {/* table surface */}
        <div
          className={`flex items-center justify-center ring-2 ${st.ring} ${st.surface} text-foreground shadow-lg transition-shadow ${
            selected ? "shadow-xl ring-primary ring-4" : ""
          }`}
          style={{
            width: w,
            height: h,
            borderRadius: radius,
            backgroundImage:
              "linear-gradient(135deg, oklch(1 0 0 / 6%), oklch(0 0 0 / 8%))",
          }}
        >
          <span className="text-[11px] font-semibold tabular">
            {table.label.replace(/^Mesa\s+/i, "").replace(/^Table\s+/i, "")}
          </span>
        </div>
        {/* status dot */}
        <span
          className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${st.dot}`}
        />

        {/* resize handle (bottom-right, edit mode only) */}
        {selected && editMode && (
          <div
            className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-full border-2 border-primary bg-background"
            onPointerDown={onResizeStart}
            style={{ zIndex: 40 }}
            aria-label="Redimensionar"
          />
        )}
        {/* rotate handle (top, edit mode only) */}
        {selected && editMode && (
          <div
            className="absolute -top-6 left-1/2 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-background"
            onPointerDown={onRotateStart}
            style={{ zIndex: 40 }}
            aria-label="Rotacionar"
          >
            <RotateCw className="h-2.5 w-2.5 text-primary" />
          </div>
        )}
      </div>
      {/* label below */}
      <div className="mt-1 text-center text-[10px] font-medium text-muted-foreground">
        {table.label}
      </div>
    </div>
  );
}

/* ── Main section ───────────────────────────────────────────────────────── */

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
  const [editMode, setEditMode] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [gridSnap, setGridSnap] = useState(false);
  const [iso, setIso] = useState(false);

  // drag state
  const [drag, setDrag] = useState<{
    type: "move" | "resize" | "rotate" | "pan";
    id: string;
    startX: number;
    startY: number;
    orig: { posX: number; posY: number; width: number; height: number; rotation: number };
  } | null>(null);
  const liveRef = useRef<{
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation: number;
  } | null>(null);
  const [liveRender, setLiveRender] = useState<{
    id: string;
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation: number;
  } | null>(null);

  // Floor plans + areas (managed entities, fetched from the API)
  interface FloorPlanView {
    id: string;
    name: string;
    areas: { id: string; name: string }[];
  }
  const [floorPlans, setFloorPlans] = useState<FloorPlanView[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [activeAreaName, setActiveAreaName] = useState<string>("Geral");

  const loadFloorPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/floor-plans");
      if (!res.ok) return;
      const data = await res.json();
      const fps = data.floorPlans ?? [];
      setFloorPlans(fps);
      if (fps.length > 0) {
        setActiveFloorId((prev) => prev ?? fps[0].id);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadFloorPlans();
  }, [loadFloorPlans]);

  const activeFloor = floorPlans.find((f) => f.id === activeFloorId);
  const managedAreas = activeFloor?.areas ?? [];
  // Use managed areas if available; fall back to deriving from table.area strings.
  const areaNames =
    managedAreas.length > 0
      ? managedAreas.map((a) => a.name)
      : Array.from(new Set(tables.map((t) => t.area ?? "Geral")));
  const effectiveAreaName = areaNames.includes(activeAreaName)
    ? activeAreaName
    : areaNames[0] ?? "Geral";
  const areaTables = tables.filter(
    (t) => (t.area ?? "Geral") === effectiveAreaName,
  );
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  async function addFloor() {
    const name = prompt("Nome do piso:");
    if (!name) return;
    const res = await fetch("/api/floor-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast({ title: "Piso criado" });
      await loadFloorPlans();
      router.refresh();
    }
  }

  async function addArea() {
    if (!activeFloorId) return;
    const name = prompt("Nome da área:");
    if (!name) return;
    const res = await fetch("/api/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floorPlanId: activeFloorId, name }),
    });
    if (res.ok) {
      toast({ title: "Área criada" });
      await loadFloorPlans();
    }
  }

  // dialogs
  const [billOpen, setBillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TableQrView | null>(null);
  const [form, setForm] = useState({ label: "", area: "", shape: "round", seats: "4" });
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Drag/resize/rotate/pan logic ─────────────────────────────────────── */

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dxPx = e.clientX - drag.startX;
      const dyPx = e.clientY - drag.startY;

      if (drag.type === "pan") {
        setPan({ x: pan.x + dxPx, y: pan.y + dyPx });
        return;
      }

      // For table ops, work in unscaled coordinates (divide by zoom)
      const dx = dxPx / zoom;
      const dy = dyPx / zoom;

      if (drag.type === "move") {
        const dxPct = (dx / rect.width) * 100;
        const dyPct = (dy / rect.height) * 100;
        let posX = drag.orig.posX + dxPct;
        let posY = drag.orig.posY + dyPct;
        if (gridSnap) {
          posX = Math.round(posX / 5) * 5;
          posY = Math.round(posY / 5) * 5;
        }
        posX = Math.max(5, Math.min(95, posX));
        posY = Math.max(5, Math.min(95, posY));
        liveRef.current = { ...drag.orig, posX, posY };
        setLiveRender({ id: drag.id, ...liveRef.current });
      } else if (drag.type === "resize") {
        const width = Math.max(30, Math.min(250, drag.orig.width + dx));
        const height = Math.max(30, Math.min(250, drag.orig.height + dy));
        liveRef.current = { ...drag.orig, width, height };
        setLiveRender({ id: drag.id, ...liveRef.current });
      } else if (drag.type === "rotate") {
        const cx = rect.left + (drag.orig.posX / 100) * rect.width;
        const cy = rect.top + (drag.orig.posY / 100) * rect.height;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
        const rotation = Math.round(angle);
        liveRef.current = { ...drag.orig, rotation };
        setLiveRender({ id: drag.id, ...liveRef.current });
      }
    }

    async function onUp() {
      const live = liveRef.current;
      if (live && drag) {
        const payload: Record<string, number> = {};
        if (Math.abs(live.posX - drag.orig.posX) > 0.1) payload.posX = live.posX;
        if (Math.abs(live.posY - drag.orig.posY) > 0.1) payload.posY = live.posY;
        if (Math.abs(live.width - drag.orig.width) > 0.5) payload.width = live.width;
        if (Math.abs(live.height - drag.orig.height) > 0.5) payload.height = live.height;
        if (Math.abs(live.rotation - drag.orig.rotation) > 0.5) payload.rotation = live.rotation;
        if (Object.keys(payload).length > 0) {
          await fetch(`/api/tables/${drag.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          router.refresh();
        }
      }
      setDrag(null);
      setLiveRender(null);
      liveRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, zoom, pan, gridSnap, router]);

  function startMove(e: React.PointerEvent, t: TableQrView) {
    if (!editMode || !canManage) return;
    e.stopPropagation();
    setSelectedId(t.id);
    setDrag({
      type: "move",
      id: t.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation },
    });
    liveRef.current = { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation };
  }

  function startResize(e: React.PointerEvent, t: TableQrView) {
    e.stopPropagation();
    setDrag({
      type: "resize",
      id: t.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation },
    });
    liveRef.current = { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation };
  }

  function startRotate(e: React.PointerEvent, t: TableQrView) {
    e.stopPropagation();
    setDrag({
      type: "rotate",
      id: t.id,
      startX: e.clientX,
      startY: e.clientY,
      orig: { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation },
    });
    liveRef.current = { posX: t.posX, posY: t.posY, width: t.width, height: t.height, rotation: t.rotation };
  }

  function startPan(e: React.PointerEvent) {
    if (editMode && canManage) {
      setDrag({
        type: "pan",
        id: "",
        startX: e.clientX,
        startY: e.clientY,
        orig: { posX: 0, posY: 0, width: 0, height: 0, rotation: 0 },
      });
    }
    setSelectedId(null);
  }

  /* ── Zoom (wheel) ────────────────────────────────────────────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.4, Math.min(2.5, z + delta)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ── CRUD ────────────────────────────────────────────────────────────── */

  function openAdd() {
    setEditing(null);
    setForm({ label: "", area: effectiveAreaName, shape: "round", seats: "4" });
    setEditOpen(true);
  }
  function openEdit(t: TableQrView) {
    setEditing(t);
    setForm({ label: t.label, area: t.area ?? "", shape: t.shape, seats: String(t.seats) });
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

  async function duplicateTable() {
    if (!selected) return;
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `${selected.label} (cópia)`,
        area: selected.area || null,
        shape: selected.shape,
        seats: selected.seats,
        posX: Math.min(90, selected.posX + 10),
        posY: Math.min(90, selected.posY + 10),
      }),
    });
    if (res.ok) {
      toast({ title: "Mesa duplicada" });
      router.refresh();
    }
  }

  async function deleteTable() {
    if (!selected) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tables/${selected.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "table_has_bills") {
          toast({ title: "Não é possível eliminar", description: "Esta mesa tem contas.", variant: "destructive" });
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

  /* ── Render ──────────────────────────────────────────────────────────── */

  const floorTransform = iso
    ? `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotateX(55deg) rotateZ(45deg)`
    : `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Floor switcher */}
        {floorPlans.length > 1 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-muted p-0.5">
            {floorPlans.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setActiveFloorId(f.id); setActiveAreaName("Geral"); }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeFloorId === f.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Area tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {areaNames.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveAreaName(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                effectiveAreaName === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {a}
            </button>
          ))}
          {canManage && (
            <button
              type="button"
              onClick={addArea}
              className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              aria-label="Adicionar área"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Editor controls */}
        {canManage && (
          <>
            <Button
              size="sm"
              variant={editMode ? "default" : "outline"}
              onClick={() => setEditMode(!editMode)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {editMode ? "Editar" : "Ver"}
            </Button>
            <Button
              size="sm"
              variant={gridSnap ? "default" : "outline"}
              onClick={() => setGridSnap(!gridSnap)}
              aria-label="Snap à grelha"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={iso ? "default" : "outline"}
              onClick={() => setIso(!iso)}
              aria-label="Vista isométrica"
            >
              <Box className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-12 text-center text-xs tabular text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova mesa
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Floor canvas */}
        <Card className="overflow-hidden lg:col-span-2">
          <div
            ref={containerRef}
            className="relative h-[460px] w-full touch-none select-none overflow-hidden bg-[radial-gradient(circle,oklch(1_0_0/5%)_1px,transparent_1px)] [background-size:24px_24px]"
            onPointerDown={startPan}
            style={{ perspective: iso ? "800px" : undefined }}
          >
            {/* Transformable floor */}
            <div
              className="absolute inset-0 origin-center"
              style={{
                transform: floorTransform,
                transformStyle: iso ? "preserve-3d" : undefined,
                transition: drag ? "none" : "transform 0.15s ease-out",
              }}
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
                    editMode={editMode && canManage}
                    livePos={liveRender?.id === t.id ? { posX: liveRender.posX, posY: liveRender.posY } : null}
                    liveSize={liveRender?.id === t.id ? { width: liveRender.width, height: liveRender.height } : null}
                    liveRotation={liveRender?.id === t.id ? liveRender.rotation : null}
                    zoom={zoom}
                    onSelect={() => setSelectedId(t.id)}
                    onPointerDown={(e) => startMove(e, t)}
                    onResizeStart={(e) => startResize(e, t)}
                    onRotateStart={(e) => startRotate(e, t)}
                  />
                ))
              )}
            </div>

            {/* Area label overlay */}
            <div className="pointer-events-none absolute left-4 top-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {effectiveAreaName}
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
                  QR. {editMode && canManage ? "Arraste para mover. Use a roda do rato para zoom." : ""}
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
                  <Badge variant="secondary" className={floorStatus(selected).surface}>
                    <span className={`mr-1 h-1.5 w-1.5 rounded-full ${floorStatus(selected).dot}`} />
                    {floorStatus(selected).label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Capacidade</div>
                    <div className="mt-0.5 flex items-center gap-1 font-medium">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {selected.seats}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Forma</div>
                    <div className="mt-0.5 font-medium capitalize">{selected.shape}</div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dimensão</div>
                    <div className="mt-0.5 font-medium tabular">
                      {Math.round(selected.width)}×{Math.round(selected.height)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rotação</div>
                    <div className="mt-0.5 font-medium tabular">
                      {Math.round(selected.rotation)}°
                    </div>
                  </div>
                  {selected.activeBill && (
                    <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Conta aberta</span>
                        <span className="text-sm font-semibold tabular text-primary">
                          {formatMoney(selected.activeBill.totalMinor, selected.activeBill.currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Button className="w-full" onClick={() => setBillOpen(true)} disabled={!selected.activeBill}>
                    <Receipt className="mr-1.5 h-4 w-4" /> Ver conta
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href={selected.payUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Ver página
                    </a>
                  </Button>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={duplicateTable}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(selected)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar {selected.label}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acção não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={deleteTable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary/60" /> Disponível</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Conta aberta</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[oklch(0.7_0.15_65)]" /> A aguardar / reservada</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Ocupada</div>
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
            <DialogDescription>{editing ? "Altere as propriedades da mesa." : "Adicione uma mesa. O QR é gerado automaticamente."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fp-label">Identificador</Label>
              <Input id="fp-label" placeholder="Mesa 8" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fp-area">Área</Label>
                <Input id="fp-area" placeholder="Interior" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-seats">Capacidade</Label>
                <Input id="fp-seats" type="number" min={1} max={20} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma</Label>
              <Select value={form.shape} onValueChange={(v) => setForm({ ...form, shape: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveTable} disabled={saving || !form.label}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? "Guardar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <BillManager
          tableId={selected.id}
          tableName={selected.label}
          open={billOpen}
          onOpenChange={(v) => { setBillOpen(v); if (!v) router.refresh(); }}
          canVoid={canManage}
        />
      )}
    </div>
  );
}
