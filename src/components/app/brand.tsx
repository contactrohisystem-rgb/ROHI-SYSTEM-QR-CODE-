import { cn } from "@/lib/utils";

/**
 * ROHI brand mark — a rounded square with a QR-table motif (four corner marks)
 * in the green accent, plus the wordmark. Used in the sidebar header.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        className="fill-primary"
      />
      {/* QR-style corner marks */}
      <rect x="8" y="8" width="5" height="5" rx="1.5" className="fill-primary-foreground" />
      <rect x="19" y="8" width="5" height="5" rx="1.5" className="fill-primary-foreground" />
      <rect x="8" y="19" width="5" height="5" rx="1.5" className="fill-primary-foreground" />
      <rect x="17" y="17" width="3" height="3" rx="1" className="fill-primary-foreground/70" />
      <rect x="21" y="21" width="3" height="3" rx="1" className="fill-primary-foreground/70" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-none">
        <div className="text-base font-semibold tracking-tight text-sidebar-foreground">
          ROHI
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          QR Pay
        </div>
      </div>
    </div>
  );
}
