import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffRole } from "@/lib/auth/session";
import { generateOpaqueToken } from "@/lib/tokens";

/**
 * POST /api/tables/[id]/rotate-token — regenerate the table's opaque QR token.
 *
 * The old token immediately stops resolving (/pay?table=<old> → invalid code),
 * so any printed QR bearing the old token becomes useless. Use when a QR card
 * is lost, stolen, or suspected compromised. The new QR encodes only the new
 * opaque token — never bill/payment data. MANAGER+.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffRole("MANAGER");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const table = await db.restaurantTable.findFirst({
    where: { id, restaurantId: auth.ctx.restaurantId },
    select: { id: true },
  });
  if (!table) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const newToken = generateOpaqueToken("tbl", 16);
  await db.restaurantTable.update({
    where: { id: table.id },
    data: { token: newToken },
  });

  return NextResponse.json({ ok: true, token: newToken });
}
