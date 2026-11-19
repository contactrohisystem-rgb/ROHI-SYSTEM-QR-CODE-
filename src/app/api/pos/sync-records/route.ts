import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/auth/session";
import { getSyncRecords } from "@/lib/pos/service";

// GET /api/pos/sync-records — recent POS sync attempts (MANAGER+).
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const records = await getSyncRecords(auth.ctx.restaurantId);
  return NextResponse.json({ records });
}
