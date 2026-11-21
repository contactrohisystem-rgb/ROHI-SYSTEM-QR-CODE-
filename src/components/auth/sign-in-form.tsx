"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().min(1, "Email obrigatório").email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type Values = z.infer<typeof schema>;

const SERIF = "var(--font-playfair), Georgia, 'Times New Roman', serif";
const FOREST = "#173C32";
const GOLD = "#C6A66B";
const CHARCOAL = "#242522";

/**
 * MARÉA staff sign-in. Premium branded login with the coastal luxury palette.
 *
 * The form is rendered inside a `theme-light` wrapper (set by page.tsx) so the
 * global `--foreground` is dark — this fixes the invisible-text issue where the
 * default dark admin theme's light foreground rendered white-on-white inside
 * the white input fields. Explicit colours are also set on inputs as a
 * defence-in-depth so text is always readable regardless of theme context.
 */
export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    if (loading) return; // guard against accidental double-submit
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (res?.error) {
        setError("Credenciais inválidas. Verifique o email e a senha.");
        setLoading(false);
        return;
      }
      // Navigate so the server component re-evaluates the session cookie and
      // renders the dashboard. replace() avoids a property-mutation that the
      // react-hooks/immutability rule flags.
      window.location.replace("/");
    } catch {
      setError("Não foi possível iniciar sessão. Verifique a ligação e tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-medium tracking-[0.35em] uppercase" style={{ color: GOLD }}>
          Coastal Dining · Maputo
        </p>
        <h1 className="text-4xl font-medium" style={{ fontFamily: SERIF, color: FOREST }}>
          MARÉA
        </h1>
        <p className="mt-3 text-sm" style={{ color: "rgba(23,60,50,0.6)" }}>
          Painel do restaurante — iniciar sessão
        </p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border p-7 shadow-sm"
        style={{ borderColor: "rgba(23,60,50,0.1)", background: "#fff", color: CHARCOAL }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" style={{ color: FOREST }}>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nome@marea.co.mz"
            style={{ color: CHARCOAL, background: "#fff" }}
            className="border-[#173C32]/15 focus-visible:border-[#C6A66B] focus-visible:ring-[#C6A66B]/30"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />{errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" style={{ color: FOREST }}>Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ color: CHARCOAL, background: "#fff" }}
              className="border-[#173C32]/15 pr-11 focus-visible:border-[#C6A66B] focus-visible:ring-[#C6A66B]/30"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#173C32]/50 transition-colors hover:bg-[#173C32]/5 hover:text-[#173C32]"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />{errors.password.message}
            </p>
          )}
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button
          type="submit"
          className="w-full text-white transition-opacity"
          style={{ background: FOREST }}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "A iniciar sessão..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[11px]" style={{ color: "rgba(23,60,50,0.35)" }}>
        MARÉA Restaurant Management · acesso reservado à equipa
      </p>
    </div>
  );
}
