import { NextResponse } from "next/server";
import { z } from "zod";
import { PosAdapterCode } from "@prisma/client";
import { requireStaffRole } from "@/lib/auth/session";
import { configurePosConnection, getPosConnection } from "@/lib/pos/service";
import { PosError } from "@/lib/pos/adapter";

const schema = z.object({
  adapterCode: z.nativeEnum(PosAdapterCode),
});

// GET /api/pos/connection — the restaurant's POS connection.
export async function GET() {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;
  const connection = await getPosConnection(auth.ctx.restaurantId);
  return NextResponse.json({ connection });
}

// POST /api/pos/connection — configure/update the POS adapter (MANAGER+).
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
  try {
    await configurePosConnection({
      restaurantId: auth.ctx.restaurantId,
      adapterCode: parsed.data.adapterCode,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PosError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
