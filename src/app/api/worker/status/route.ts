import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/session";
import { getLastTick, startWorker } from "@/lib/worker";

// GET /api/worker/status — last worker tick info (observability). MANAGER+.
//
// Also lazy-starts the worker (idempotent). This is a fallback for environments
// where the instrumentation hook didn't run (e.g. dev server started before
// src/instrumentation.ts existed and hasn't restarted). startWorker() is
// guarded by a global flag so calling it on every request is safe.
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  startWorker();
  return NextResponse.json({ lastTick: getLastTick() });
}
