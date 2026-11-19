"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    await signOut({ redirect: false });
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handle}
      disabled={loading}
      aria-label="Terminar sessão"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span className="ml-2 hidden sm:inline">Sair</span>
    </Button>
  );
}
