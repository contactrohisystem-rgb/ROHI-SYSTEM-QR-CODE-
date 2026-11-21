"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { contrastForeground } from "@/lib/brand";

interface Profile {
  id: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  locale: string;
  logoUrl: string | null;
  coverUrl: string | null;
  brandPrimary: string | null;
  brandSecondary: string | null;
  brandAccent: string | null;
  appearance: string;
  // Stage 13G: reservation policy
  slug: string | null;
  description: string | null;
  reservationsEnabled: boolean;
  openingHours: string | null;
  defaultReservationDurationMins: number;
  minNoticeMins: number;
  maxAdvanceDays: number;
  maxPartySize: number;
  reservationApprovalMode: string;
  reservationCancellationPolicy: string | null;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#16a34a"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent"
          aria-label={label}
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#16a34a"
          className="h-9 font-mono text-sm"
        />
      </div>
    </div>
  );
}

export function SettingsSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/restaurant")
      .then((r) => r.json())
      .then((d) => setProfile(d.restaurant ?? null))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone || null,
          address: profile.address || null,
          logoUrl: profile.logoUrl || null,
          coverUrl: profile.coverUrl || null,
          brandPrimary: profile.brandPrimary || null,
          brandSecondary: profile.brandSecondary || null,
          brandAccent: profile.brandAccent || null,
          appearance: profile.appearance,
          description: profile.description || null,
          reservationsEnabled: profile.reservationsEnabled,
          openingHours: profile.openingHours || null,
          defaultReservationDurationMins: profile.defaultReservationDurationMins,
          minNoticeMins: profile.minNoticeMins,
          maxAdvanceDays: profile.maxAdvanceDays,
          maxPartySize: profile.maxPartySize,
          reservationApprovalMode: profile.reservationApprovalMode,
          reservationCancellationPolicy: profile.reservationCancellationPolicy || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Definições guardadas" });
      router.refresh(); // apply the brand across the dashboard
    } catch {
      toast({ title: "Erro ao guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sem restaurante configurado.
        </CardContent>
      </Card>
    );
  }

  const previewPrimary = profile.brandPrimary || "#16a34a";
  const previewFg = contrastForeground(previewPrimary);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Definições</h2>
          <p className="text-sm text-muted-foreground">
            Perfil, identidade e aparência do restaurante
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Perfil do restaurante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={profile.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={profile.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo">URL do logótipo</Label>
                <Input
                  id="logo"
                  value={profile.logoUrl ?? ""}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cover">URL da capa</Label>
                <Input
                  id="cover"
                  value={profile.coverUrl ?? ""}
                  onChange={(e) => set("coverUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pré-visualização
            </CardTitle>
            <CardDescription>Como a marca aparece</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                background:
                  profile.appearance === "light" ? "#fff" : "oklch(0.16 0.013 255)",
                color: profile.appearance === "light" ? "#1a1a1a" : "#f5f5f5",
              }}
            >
              <div
                className="h-16"
                style={{ background: previewPrimary }}
              />
              <div className="p-3">
                <div className="flex items-center gap-2">
                  {profile.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt=""
                      className="h-8 w-8 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold"
                      style={{ background: previewPrimary, color: previewFg }}
                    >
                      {profile.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-semibold">{profile.name}</span>
                </div>
                <button
                  className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ background: previewPrimary, color: previewFg }}
                >
                  Pagar
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Marca e aparência
          </CardTitle>
          <CardDescription>
            Aplicado ao painel de funcionários e à experiência do cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ColorField
              label="Cor principal"
              value={profile.brandPrimary ?? ""}
              onChange={(v) => set("brandPrimary", v)}
            />
            <ColorField
              label="Cor secundária"
              value={profile.brandSecondary ?? ""}
              onChange={(v) => set("brandSecondary", v)}
            />
            <ColorField
              label="Cor de destaque"
              value={profile.brandAccent ?? ""}
              onChange={(v) => set("brandAccent", v)}
            />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Aparência do painel</Label>
            <Select
              value={profile.appearance}
              onValueChange={(v) => set("appearance", v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reservation policy (Stage 13G) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reservas
          </CardTitle>
          <CardDescription>
            Política de reservas e página pública de reservas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.slug && (
            <div className="space-y-1.5">
              <Label className="text-xs">Link público de reservas</Label>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">/r/{profile.slug}</span>
                <a
                  href={`/r/${profile.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-primary hover:underline"
                >
                  Abrir
                </a>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Aceitar reservas online</Label>
              <p className="text-xs text-muted-foreground">Desactive para pausar as reservas públicas</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={profile.reservationsEnabled}
              onClick={() => set("reservationsEnabled", !profile.reservationsEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${profile.reservationsEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${profile.reservationsEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição pública</Label>
            <Input
              value={profile.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Cozinha moçambicana de autor..."
              maxLength={1000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Duração padrão (min)</Label>
              <Input type="number" min={30} max={240} value={profile.defaultReservationDurationMins} onChange={(e) => set("defaultReservationDurationMins", parseInt(e.target.value || "90", 10))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aviso mínimo (min)</Label>
              <Input type="number" min={0} value={profile.minNoticeMins} onChange={(e) => set("minNoticeMins", parseInt(e.target.value || "0", 10))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Antecedência máx (dias)</Label>
              <Input type="number" min={1} value={profile.maxAdvanceDays} onChange={(e) => set("maxAdvanceDays", parseInt(e.target.value || "60", 10))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Grupo máximo</Label>
              <Input type="number" min={1} value={profile.maxPartySize} onChange={(e) => set("maxPartySize", parseInt(e.target.value || "12", 10))} />
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Modo de aprovação</Label>
            <Select
              value={profile.reservationApprovalMode}
              onValueChange={(v) => set("reservationApprovalMode", v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">Confirmação pela equipa</SelectItem>
                <SelectItem value="AUTO">Confirmação automática</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {profile.reservationApprovalMode === "AUTO"
                ? "Reservas são confirmadas automaticamente e uma mesa é atribuída."
                : "Reservas ficam pendentes até a equipa confirmar e atribuir mesa."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Política de cancelamento</Label>
            <Input
              value={profile.reservationCancellationPolicy ?? ""}
              onChange={(e) => set("reservationCancellationPolicy", e.target.value)}
              placeholder="Cancelamento gratuito até 2h antes..."
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
