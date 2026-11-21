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
 * instrumentation chunk (which caused "Module not found: Can't resolve
 * 'jsonwebtoken'"), the worker is loaded via a dynamic import guarded by
 * `process.env.NEXT_RUNTIME === 'nodejs'`. Turbopack only resolves the
 * worker module (and its transitive imports) in the Node bundle — never in
 * the Edge bundle. This is the standard Next.js instrumentation pattern.
 *
 * The worker (POS sync retries + payment reconciliation) only runs in the
 * Node.js server process.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("@/lib/worker");
    startWorker();
  }
}
