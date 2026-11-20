/**
 * Brand helpers for per-restaurant theming.
 *
 * The restaurant's brand colours (hex) are applied as CSS custom properties
 * (--primary, --ring, etc.) on a wrapper element, overriding the design
 * system defaults. This keeps the design system consistent while letting each
 * restaurant express its identity — no hardcoded colours in components.
 */

export interface RestaurantBrand {
  primary?: string;
  secondary?: string;
  accent?: string;
  logoUrl?: string;
  appearance?: string; // "dark" | "light"
}

/**
 * Choose a readable foreground (dark or white) for a given hex background,
 * using relative luminance. Keeps primary-button text accessible across brands.
 */
export function contrastForeground(hex?: string): string {
  if (!hex) return "#ffffff";
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "#ffffff";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#141414" : "#ffffff";
}

/**
 * Build the CSS custom-properties object for a brand. These override the
 * design-system tokens on a wrapper, so all `bg-primary`/`text-primary`/
 * `ring` etc. adopt the restaurant's colour.
 */
export function brandCssVars(
  brand: RestaurantBrand | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};
  if (brand?.primary) {
    const fg = contrastForeground(brand.primary);
    vars["--primary"] = brand.primary;
    vars["--primary-foreground"] = fg;
    vars["--ring"] = brand.primary;
    vars["--sidebar-primary"] = brand.primary;
    vars["--sidebar-primary-foreground"] = fg;
    vars["--chart-1"] = brand.primary;
  }
  if (brand?.secondary) {
    vars["--chart-2"] = brand.secondary;
  }
  if (brand?.accent) {
    vars["--chart-3"] = brand.accent;
  }
  return vars;
}
