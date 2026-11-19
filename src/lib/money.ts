/**
 * ROHI money utilities.
 *
 * INVARIANT: all monetary values are stored and computed as INTEGER MINOR
 * UNITS (centavos for MZN; 1 MZN = 100 centavos). Floating-point is NEVER
 * used for money anywhere in the platform.
 *
 * These helpers parse user-entered decimal strings into minor units and
 * format minor units back to display strings, using ONLY string and integer
 * arithmetic — no parseFloat, no multiplication of floats.
 *
 *   parseDecimalToMinor("12,50", "MZN") -> 1250
 *   formatMoney(1250, "MZN")            -> "Mt 12.50"
 */

const DECIMALS: Record<string, number> = {
  MZN: 2,
  USD: 2,
  EUR: 2,
  ZAR: 2,
};

export function decimalsFor(currency: string): number {
  return DECIMALS[currency] ?? 2;
}

/**
 * Normalize a user-entered amount string into a plain "ddd.dd" form.
 * Handles both "." and "," as decimal separators (PT locale uses ",") and
 * thousands separators.
 *   "12,50"     -> "12.50"
 *   "1.250,00"  -> "1250.00"
 *   "12"        -> "12"
 *   "0.99"      -> "0.99"
 */
function normalizeDecimalString(input: string): string {
  let s = input.trim().replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // The rightmost of (comma, dot) is the decimal separator; remove the other.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return s;
}

/**
 * Parse a user-entered decimal amount into integer minor units.
 * Returns null if the input is invalid or out of safe integer range.
 * Pure string/integer math.
 *
 *   parseDecimalToMinor("12,50", "MZN") -> 1250
 *   parseDecimalToMinor("0.99", "MZN")  -> 99
 *   parseDecimalToMinor("12", "MZN")    -> 1200
 *   parseDecimalToMinor("abc", "MZN")   -> null
 */
export function parseDecimalToMinor(
  input: string,
  currency = "MZN",
): number | null {
  if (typeof input !== "string") return null;
  const norm = normalizeDecimalString(input);
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  const decimals = decimalsFor(currency);
  const negative = norm.startsWith("-");
  const abs = negative ? norm.slice(1) : norm;
  const [intPart, fracRaw = ""] = abs.split(".");
  // Pad/truncate the fraction to exactly `decimals` digits (truncation toward
  // zero — staff are expected to enter at most 2 decimals for MZN).
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${intPart}${frac}`;
  const minor = Number.parseInt(combined, 10);
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/**
 * Format integer minor units as a decimal string "ddd.dd" (no currency
 * symbol). Pure string math.
 *   formatMinorToDecimal(1250, "MZN") -> "12.50"
 *   formatMinorToDecimal(99, "MZN")   -> "0.99"
 *   formatMinorToDecimal(-500, "MZN") -> "-5.00"
 */
export function formatMinorToDecimal(minor: number, currency = "MZN"): string {
  const decimals = decimalsFor(currency);
  const negative = minor < 0;
  const absMinor = Math.abs(minor);
  const absStr = String(absMinor).padStart(decimals + 1, "0");
  const intPart = absStr.slice(0, absStr.length - decimals) || "0";
  const fracPart = absStr.slice(absStr.length - decimals);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fracPart}`;
}

/**
 * Format minor units as a display string with currency symbol.
 *   formatMoney(1250, "MZN", "pt") -> "Mt 12.50"
 *   formatMoney(1250, "MZN", "en") -> "12.50 MZN"
 */
export function formatMoney(
  minor: number,
  currency = "MZN",
  locale = "pt",
): string {
  const amount = formatMinorToDecimal(minor, currency);
  if (currency === "MZN") {
    return locale === "en" ? `${amount} MZN` : `Mt ${amount}`;
  }
  return `${amount} ${currency}`;
}

/** Integer line-item total: quantity * unit price (minor). Pure integer math. */
export function lineTotalMinor(quantity: number, unitPriceMinor: number): number {
  return quantity * unitPriceMinor;
}

/** Sum an array of minor-unit values. */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
