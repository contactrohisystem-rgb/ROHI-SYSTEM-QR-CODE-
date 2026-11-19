import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffRole } from "@/lib/auth/session";
import { setMockPosFailure, getMockPosFailure } from "@/lib/pos/service";

const schema = z.object({
  enabled: z.boolean(),
});

// POST /api/pos/mock/simulate-failure — toggle MockPosAdapter failure
// simulation (DEMO ONLY). When on, confirmPayment throws so the retry/backoff
// mechanism can be observed. (MANAGER+)
export async function POST(req: Request) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  setMockPosFailure(parsed.data.enabled);
  return NextResponse.json({ ok: true, simulatedFailure: parsed.data.enabled });
}

// GET — current simulation state.
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ simulatedFailure: getMockPosFailure() });
}
