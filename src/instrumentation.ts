import { startWorker } from "@/lib/worker";

/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * Starts the in-process background worker (POS sync retries + payment
 * reconciliation). See src/lib/worker.ts.
 */
export async function register(): Promise<void> {
  startWorker();
}
