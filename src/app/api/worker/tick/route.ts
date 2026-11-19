import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/session";
import { runWorkerTick } from "@/lib/worker";

// POST /api/worker/tick — manually trigger a worker tick (process due POS
// syncs + reconcile stuck payments). MANAGER+.
//
// In production this is the endpoint an external scheduler/cron would call
// every minute (instead of the in-process interval). The logic is identical
// and shared in runWorkerTick().
export async function POST() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const result = await runWorkerTick();
  return NextResponse.json(result);
}
