import { headers } from "next/headers";

/**
 * Returns the public base URL used for externally-facing links — primarily
 * the QR code target URL that a guest scans.
 *
 * Priority:
 *   1. NEXTAUTH_URL env (explicit configuration — recommended for pilot).
 *   2. Derived from request headers (x-forwarded-host / host + protocol).
 *
 * For pilot/production, set NEXTAUTH_URL to the public domain the guest's
 * phone can reach (e.g. https://pay.rohi.co.mz).
 */
export async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
