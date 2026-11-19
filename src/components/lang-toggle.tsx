"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Language toggle for the guest /pay page.
 * Sets the NEXT_LOCALE cookie (read by src/i18n/request.ts) and refreshes
 * so the server component re-renders in the new locale.
 */
export function LangToggle({
  locale,
  className,
}: {
  locale: "pt" | "en";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | "pt" | "en">(null);

  async function setLocale(l: "pt" | "en") {
    if (l === locale) return;
    setLoading(l);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: l }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className={`inline-flex items-center rounded-md border p-0.5 ${className ?? ""}`}
      role="group"
      aria-label="Language"
    >
      {(["pt", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          disabled={loading !== null}
          className={`rounded px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
