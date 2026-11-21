"use client";

import { useState } from "react";
import { CalendarCheck, Check, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tableToken: string;
  locale: "pt" | "en";
  areaOptions?: string[];
}

const DURATIONS = [
  { value: "60", pt: "1 hora", en: "1 hour" },
  { value: "90", pt: "1h 30", en: "1h 30" },
  { value: "120", pt: "2 horas", en: "2 hours" },
  { value: "180", pt: "3 horas", en: "3 hours" },
];

/**
 * Guest reservation form (mobile-first, light theme).
 * Submits a PENDING reservation the restaurant confirms via the dashboard.
 * Performs a soft availability check before submit.
 */
export function GuestReservationForm({ tableToken, locale, areaOptions = [] }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState(() => defaultDateTime());
  const [duration, setDuration] = useState("90");
  const [areaPref, setAreaPref] = useState("__none__");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const t = (pt: string, en: string) => (locale === "pt" ? pt : en);

  // Default the datetime-local to "tonight at 20:00" on first render.
  function defaultDateTime(): string {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    // Round to nearest 15 min and format as yyyy-MM-ddTHH:mm (local)
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function submit() {
    if (!name || !phone || !date) {
      toast({ title: t("Preencha os campos obrigatórios", "Fill required fields"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const iso = new Date(date).toISOString();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken,
          customerName: name,
          phone,
          partySize: parseInt(partySize, 10),
          date: iso,
          durationMins: parseInt(duration, 10),
          areaPreference: areaPref === "__none__" ? undefined : areaPref,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setDone(true);
        toast({ title: t("Reserva enviada!", "Reservation submitted!") });
      } else {
        const d = await res.json().catch(() => ({}));
        if (d.error === "no_availability") {
          toast({ title: t("Sem disponibilidade", "No availability"), variant: "destructive" });
        } else {
          toast({ title: t("Erro ao enviar", "Submit failed"), variant: "destructive" });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <p className="text-base font-semibold">
          {t("Reserva enviada!", "Reservation submitted!")}
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {t(
            "O restaurante irá confirmar a sua reserva. Chegue com 5 minutos de antecedência.",
            "The restaurant will confirm your reservation. Please arrive 5 minutes early.",
          )}
        </p>
        <Button variant="outline" onClick={() => {
          setDone(false);
          setName(""); setPhone(""); setPartySize("2"); setDate(""); setDuration("90"); setAreaPref("__none__"); setNotes("");
        }}>
          {t("Nova reserva", "New reservation")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium">{t("Reservar mesa", "Reserve a table")}</p>
          <p className="text-xs text-muted-foreground">
            {t("Preencha os dados — o restaurante confirma.", "Fill in your details — the restaurant confirms.")}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="rsv-name" className="text-xs">{t("Nome", "Name")}</Label>
          <Input id="rsv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("O seu nome", "Your name")} className="h-10" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="rsv-phone" className="text-xs">{t("Telefone", "Phone")}</Label>
            <Input id="rsv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+258..." inputMode="tel" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rsv-party" className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />{t("Pessoas", "Guests")}</Label>
            <Input id="rsv-party" value={partySize} onChange={(e) => setPartySize(e.target.value)} type="number" min={1} max={20} className="h-10" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rsv-date" className="text-xs">{t("Data e hora", "Date and time")}</Label>
          <Input
            id="rsv-date"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="rsv-dur" className="text-xs">{t("Duração", "Duration")}</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="rsv-dur" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{locale === "pt" ? d.pt : d.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {areaOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="rsv-area" className="text-xs">{t("Área", "Area")}</Label>
              <Select value={areaPref} onValueChange={setAreaPref}>
                <SelectTrigger id="rsv-area" className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("Sem preferência", "No preference")}</SelectItem>
                  {areaOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rsv-notes" className="text-xs">{t("Notas (opcional)", "Notes (optional)")}</Label>
          <Textarea id="rsv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Aniversário, cadeira de bebé...", "Birthday, high chair...")} rows={2} className="text-sm" />
        </div>

        <Button onClick={submit} disabled={submitting || !name || !phone || !date} className="w-full">
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-1.5 h-4 w-4" />}
          {t("Enviar reserva", "Submit reservation")}
        </Button>
      </div>
    </div>
  );
}
