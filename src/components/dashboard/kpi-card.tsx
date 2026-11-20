import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "primary" | "amber" | "rose" | "teal" | "neutral";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: "bg-primary/12", fg: "text-primary" },
  amber: { bg: "bg-[oklch(0.7_0.15_65/0.14)]", fg: "text-[oklch(0.78_0.15_65)]" },
  rose: { bg: "bg-destructive/12", fg: "text-destructive" },
  teal: { bg: "bg-[oklch(0.6_0.1_195/0.14)]", fg: "text-[oklch(0.7_0.1_195)]" },
  neutral: { bg: "bg-muted", fg: "text-muted-foreground" },
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              t.bg,
            )}
          >
            <Icon className={cn("h-4 w-4", t.fg)} />
          </div>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight tabular">
          {value}
        </div>
        {hint && (
          <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
