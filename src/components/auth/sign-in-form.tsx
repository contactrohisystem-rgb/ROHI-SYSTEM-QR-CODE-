"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().min(1, "Email obrigatório").email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

type Values = z.infer<typeof schema>;

const SERIF = "var(--font-playfair), Georgia, 'Times New Roman', serif";

/**
 * MARÉA staff sign-in. Branded for the prototype with the coastal luxury
 * palette (forest green / ivory / gold). Authenticates via NextAuth
 * credentials; the session carries the active restaurant context.
 */
export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Credenciais inválidas. Verifique o email e a senha.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-medium tracking-[0.35em] uppercase" style={{ color: "#C6A66B" }}>
          Coastal Dining · Maputo
        </p>
        <h1 className="text-4xl font-medium" style={{ fontFamily: SERIF, color: "#173C32" }}>
          MARÉA
        </h1>
        <p className="mt-3 text-sm text-[#173C32]/60">Painel do restaurante — iniciar sessão</p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-2xl border border-[#173C32]/10 bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="email" style={{ color: "#173C32" }}>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nome@marea.co.mz"
            className="border-[#173C32]/15"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" style={{ color: "#173C32" }}>Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="border-[#173C32]/15"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full text-white"
          style={{ background: "#173C32" }}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
        <p className="text-center text-[11px] text-[#173C32]/40">
          Demo: owner@rohi.demo · demo1234
        </p>
      </form>
    </div>
  );
}
