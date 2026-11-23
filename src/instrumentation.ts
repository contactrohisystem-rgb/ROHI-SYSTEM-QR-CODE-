/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * IMPORTANT (Edge Runtime guard):
 * The worker imports the payment registry, which imports the M-Pesa provider
 * (src/lib/payments/providers/mpesa.ts). The M-Pesa provider dynamically
 * imports `jsonwebtoken` — a Node-only module that cannot be bundled into the
 * Edge Runtime. The same chain pulls in `node:crypto` (POS service / mock
 * provider) which is also Node-only.
 *
 * To prevent these Node-only dependencies from being bundled into the Edge
 * instrumentation chunk, the worker is loaded via a dynamic import guarded by
 * `process.env.NEXT_RUNTIME === 'nodejs'`. Turbopack only resolves the worker
 * module (and its transitive imports) in the Node bundle — never in Edge.
 *
 * Production security check: NEXTAUTH_SECRET must be set in production.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Production security check: NEXTAUTH_SECRET must be set in production.
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.NEXTAUTH_SECRET
    ) {
      console.error(
        "FATAL: NEXTAUTH_SECRET is not set. Session JWTs are INSECURE. " +
          "Generate one with: openssl rand -hex 32",
      );
    }

    const { startWorker } = await import("@/lib/worker");
    startWorker();
  }
}
