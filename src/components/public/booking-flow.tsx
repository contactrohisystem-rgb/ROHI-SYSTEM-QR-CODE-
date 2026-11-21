"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Check,
  Clock,
  Loader2,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  slug: string;
  restaurant: {
    defaultReservationDurationMins: number;
    maxPartySize: number;
    approvalMode: string;
  };
  areas: string[];
}

interface Slot {
  time: string;
  availableTables: number;
}

const DURATIONS = [
  { value: "60", label: "1h" },
  { value: "90", label: "1h 30" },
  { value: "120", label: "2h" },
  { value: "180", label: "3h" },
];

/**
 * Customer booking flow (Stage 13A). Mobile-first, light theme.
 *
 * Steps: pick date + party size + duration → load available time slots → pick a
 * slot → fill name/phone/notes → submit → see confirmation + reference.
 *
 * Uses the public slots endpoint (no auth) and the reservations POST
 * (restaurantSlug mode). The reservation is created as PENDING (or CONFIRMED
 * if the restaurant uses AUTO approval) and a human-readable reference is
 * returned for later status lookup.
 */
export function BookingFlow({ slug, restaurant, areas }: Props) {
  const { toast } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [partySize, setPartySize] = useState("2");
  const [duration, setDuration] = useState(String(restaurant.defaultReservationDurationMins));
  const [areaPref, setAreaPref] = useState("__none__");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    reference: string;
    status: string;
    date: string;
    partySize: number;
  } | null>(null);

  // Load slots whenever date/party/duration/area changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedTime(null);
    const params = new URLSearchParams({
      date,
      partySize,
      durationMins: duration,
    });
    if (areaPref !== "__none__") params.set("areaPreference", areaPref);
    fetch(`/api/restaurants/${encodeURIComponent(slug)}/slots?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots(d.slots ?? []);
      })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [slug, date, partySize, duration, areaPref]);

  function adjustParty(delta: number) {
    setPartySize((prev) => {
      const n = Math.max(1, Math.min(restaurant.maxPartySize, parseInt(prev || "1", 10) + delta));
      return String(n);
    });
  }

  async function submit() {
    if (!selectedTime || !name || !phone) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Combine the selected date + time into an ISO datetime.
      const iso = new Date(`${date}T${selectedTime}:00`).toISOString();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug: slug,
          customerName: name,
          phone,
          partySize: parseInt(partySize, 10),
          date: iso,
          durationMins: parseInt(duration, 10),
          areaPreference: areaPref === "__none__" ? undefined : areaPref,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmation({
          reference: data.reservation?.reference ?? "—",
          status: data.reservation?.status ?? "PENDING",
          date: data.reservation?.date ?? iso,
          partySize: parseInt(partySize, 10),
        });
        toast({ title: "Reserva criada!" });
      } else {
        toast({ title: data.message ?? data.error ?? "Erro", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmation screen
  if (confirmation) {
    const confirmed = confirmation.status === "CONFIRMED";
    return (
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className={`px-4 py-5 text-center ${confirmed ? "bg-primary/10" : "bg-amber-500/10"}`}>
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${confirmed ? "bg-primary/15" : "bg-amber-500/15"}`}>
            <Check className={`h-8 w-8 ${confirmed ? "text-primary" : "text-amber-600"}`} />
          </div>
          <p className="mt-2 text-base font-semibold">
            {confirmed ? "Reserva confirmada!" : "Reserva recebida!"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {confirmed
              ? "O seu lugar está garantido."
              : "Aguarde a confirmação da equipa do restaurante."}
          </p>
        </div>
        <div className="space-y-2 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Referência</span>
            <span className="font-mono font-semibold">{confirmation.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data</span>
            <span>{new Date(confirmation.date).toLocaleString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pessoas</span>
            <span>{confirmation.partySize}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="secondary" className={confirmed ? "bg-primary/12 text-primary" : "bg-amber-500/15 text-amber-600"}>
              {confirmed ? "Confirmada" : "Pendente"}
            </Badge>
          </div>
        </div>
        <div className="border-t border-border/60 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            Guarde a sua referência para consultar ou cancelar a reserva.
          </p>
          <Button variant="outline" className="mt-2 w-full" onClick={() => {
            setConfirmation(null);
            setName(""); setPhone(""); setNotes(""); setSelectedTime(null);
          }}>
            Fazer nova reserva
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date + party + duration selectors */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="bk-date" className="text-xs">Data</Label>
          <Input id="bk-date" type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />Pessoas</Label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" className="h-9 w-9 p-0" onClick={() => adjustParty(-1)} aria-label="Diminuir">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="flex-1 text-center text-sm font-semibold tabular">{partySize}</span>
              <Button type="button" variant="outline" className="h-9 w-9 p-0" onClick={() => adjustParty(1)} aria-label="Aumentar">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {areas.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Área preferida</Label>
            <Select value={areaPref} onValueChange={setAreaPref}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem preferência</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Available time slots */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Horários disponíveis</span>
          {loadingSlots && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {!loadingSlots && slots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sem disponibilidade para esta data. Tente outro dia ou reduza o grupo.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                onClick={() => setSelectedTime(s.time)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  selectedTime === s.time
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Guest details (shown once a slot is picked) */}
      {selectedTime && (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="bk-name" className="text-xs">Nome</Label>
            <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="O seu nome" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-phone" className="text-xs">Telefone</Label>
            <Input id="bk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+258..." inputMode="tel" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-notes" className="text-xs">Pedidos especiais (opcional)</Label>
            <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Aniversário, cadeira de bebé..." rows={2} className="text-sm" />
          </div>
          <Button onClick={submit} disabled={submitting || !name || !phone} className="w-full">
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-1.5 h-4 w-4" />}
            Confirmar reserva · {selectedTime}
          </Button>
        </div>
      )}
    </div>
  );
}
