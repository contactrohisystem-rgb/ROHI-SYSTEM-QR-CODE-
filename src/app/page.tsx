import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Unauthenticated: render the sign-in gate. The "/" route is the only
  // user-visible page in the staff surface; signing in swaps it for the
  // dashboard shell via router.refresh().
  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-4">
          <SignInForm />
        </div>
        <footer className="border-t p-4 text-center text-xs text-muted-foreground">
          ROHI — Pagamento QR para restaurantes · Moçambique
        </footer>
      </main>
    );
  }

  const u = session.user;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">ROHI</span>
            {u.activeRestaurantName && (
              <Badge variant="secondary">{u.activeRestaurantName}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium leading-tight">
                {u.name ?? u.email}
              </div>
              {u.activeRole && (
                <div className="text-xs text-muted-foreground">
                  {u.activeRole}
                </div>
              )}
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Painel do restaurante</CardTitle>
            <CardDescription>
              Sessão activa. A gestão de mesas, contas e pagamentos chega na
              próxima tarefa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Restaurante</span>
              <span className="font-medium">
                {u.activeRestaurantName ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Papel</span>
              <span className="font-medium">{u.activeRole ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Papel na plataforma</span>
              <span className="font-medium">{u.platformRole}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-5xl p-4 text-center text-xs text-muted-foreground">
          ROHI — Pagamento QR para restaurantes · Moçambique
        </div>
      </footer>
    </main>
  );
}
