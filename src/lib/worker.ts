import { processDueSyncRecords } from "@/lib/pos/service";
import { reconcilePayments } from "@/lib/payments/reconciliation";

/**
 * In-process background worker. While the server process is alive, it runs a
 * tick every TICK_INTERVAL_MS that:
 *   1. Processes due POS sync records (retries with backoff).
 *   2. Reconciles stuck payments (missed-webhook recovery).
 *
 * DEV/PILOT worker (single long-running server process). For multi-instance
 * production, replace with an external scheduler/queue that calls
 * runWorkerTick() via POST /api/worker/tick — the logic is shared here so the
 * switch is mechanical.
 */
const TICK_INTERVAL_MS = Number(process.env.ROHI_WORKER_INTERVAL_MS ?? 15_000);

const globalForWorker = globalThis as unknown as {
  __rohiWorkerStarted?: boolean;
};

export interface WorkerTickResult {
  at: number;
  // Per-tick counts (what the last tick did).
  syncsAttempted: number;
  paymentsReconciled: number;
  // Cumulative counts since the worker started (proves the worker has done
  // work over time, even if the last tick was idle).
  cumulativeSyncs: number;
  cumulativeReconciled: number;
  error?: string;
}

let lastTick: WorkerTickResult | null = null;
let cumulativeSyncs = 0;
let cumulativeReconciled = 0;

export function getLastTick(): WorkerTickResult | null {
  return lastTick;
}

export async function runWorkerTick(): Promise<WorkerTickResult> {
  let syncsAttempted = 0;
  let paymentsReconciled = 0;
  let error: string | undefined;
  try {
    const syncs = await processDueSyncRecords();
    syncsAttempted = syncs.attempted;
    cumulativeSyncs += syncsAttempted;
    const recon = await reconcilePayments();
    paymentsReconciled = recon.reconciled;
    cumulativeReconciled += paymentsReconciled;
  } catch (e) {
    error = e instanceof Error ? e.message : "unknown";
    // Don't rethrow — the interval must keep running.
  }
  lastTick = {
    at: Date.now(),
    syncsAttempted,
    paymentsReconciled,
    cumulativeSyncs,
    cumulativeReconciled,
    error,
  };
  return lastTick;
}

/**
 * Start the background worker interval. Idempotent — guarded by a global flag
 * so dev hot-reloads don't start duplicate intervals. Only starts in the
 * Node.js runtime (not during build/edge).
 */
export function startWorker(): void {
  if (globalForWorker.__rohiWorkerStarted) return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  globalForWorker.__rohiWorkerStarted = true;

  // First tick shortly after start so the worker is active immediately.
  setTimeout(() => {
    runWorkerTick().catch((e) => {
      console.error("[rohi-worker] initial tick failed:", e);
    });
  }, 5_000);

  setInterval(() => {
    runWorkerTick().catch((e) => {
      console.error("[rohi-worker] tick failed:", e);
    });
  }, TICK_INTERVAL_MS);
}
