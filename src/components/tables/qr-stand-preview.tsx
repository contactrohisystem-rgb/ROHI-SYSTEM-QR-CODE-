/**
 * Premium QR table-stand preview — a CSS visualization of how the QR code
 * appears physically on a restaurant table (warm wood surface, brushed-metal
 * easel stand, white QR card). Decorative; helps managers understand the
 * physical artefact before printing.
 */
export function QrStandPreview({
  qrDataUrl,
  label,
}: {
  qrDataUrl: string;
  label: string;
}) {
  return (
    <div
      className="relative h-56 w-full overflow-hidden rounded-xl"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 120%, oklch(0.32 0.04 60) 0%, oklch(0.26 0.05 55) 60%, oklch(0.18 0.04 50) 100%)",
      }}
    >
      {/* warm light glow */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 40% at 30% 20%, oklch(0.85 0.08 70 / 0.25) 0%, transparent 70%)",
        }}
      />
      {/* wood grain */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, oklch(0.2 0.05 50 / 0.4) 0px, transparent 2px, transparent 7px, oklch(0.3 0.06 55 / 0.3) 8px, transparent 10px, transparent 16px)",
        }}
      />

      {/* shadow under the stand */}
      <div className="absolute bottom-7 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-black/40 blur-md" />

      {/* stand + card */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="relative" style={{ perspective: "600px" }}>
          {/* metal back plate */}
          <div
            className="absolute left-1/2 top-0 h-24 w-1.5 -translate-x-1/2 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.45 0.01 270), oklch(0.75 0.02 270), oklch(0.5 0.01 270))",
              transform: "translateX(-50%) rotateX(-8deg)",
            }}
          />
          {/* horizontal base */}
          <div
            className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.4 0.01 270), oklch(0.7 0.02 270), oklch(0.4 0.01 270))",
            }}
          />
          {/* the QR card, leaning slightly */}
          <div
            className="relative rounded-lg bg-white p-2 shadow-2xl"
            style={{
              transform: "rotateX(8deg)",
              width: 104,
              boxShadow:
                "0 18px 30px -8px oklch(0 0 0 / 0.55), 0 4px 8px oklch(0 0 0 / 0.3)",
            }}
          >
            <img
              src={qrDataUrl}
              alt={`QR code for ${label}`}
              className="h-24 w-24"
            />
            <div className="mt-1 text-center text-[9px] font-semibold tracking-wide text-neutral-700">
              {label}
            </div>
          </div>
        </div>
      </div>

      {/* subtle table edge highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}
