import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recomputeBillTotals, openBillOnTable } from "@/lib/billing";

/**
 * GET /api/orders — two modes:
 *   Staff: MANAGER+ — lists orders for the active restaurant.
 *   Guest: ?tableToken=<opaque> — lists orders for the table (tracking).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tableToken = url.searchParams.get("tableToken");

  if (tableToken) {
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: { select: { id: true, status: true } } },
    });
    if (!table || table.restaurant.status !== "active")
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    const orders = await db.customerOrder.findMany({
      where: { tableId: table.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { items: true },
    });
    return NextResponse.json({ orders });
  }

  // Staff — lazy import to avoid circular deps at module load
  const { requireStaffRole } = await import("@/lib/auth/session");
  const auth = await requireStaffRole("SERVER");
  if (!auth.ok) return auth.response;
  const orders = await db.customerOrder.findMany({
    where: { restaurantId: auth.ctx.restaurantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true, table: { select: { label: true } } },
  });
  return NextResponse.json({ orders });
}

const submitSchema = z.object({
  tableToken: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).max(50),
      notes: z.string().max(200).optional(),
    }),
  ).min(1),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/orders — guest submits an order (token-gated).
 * Creates a CustomerOrder (SUBMITTED) + CustomerOrderItems with price
 * snapshots from the DB (never trusts client-supplied prices).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { tableToken, items, notes } = parsed.data;
  const table = await db.restaurantTable.findUnique({
    where: { token: tableToken },
    include: { restaurant: { select: { id: true, status: true } } },
  });
  if (!table || table.restaurant.status !== "active")
    return NextResponse.json({ error: "invalid_table" }, { status: 404 });

  const restaurantId = table.restaurant.id;

  // Fetch products from DB (validate availability + snapshot prices server-side)
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, restaurantId, available: true },
  });
  if (products.length !== productIds.length)
    return NextResponse.json({ error: "product_unavailable" }, { status: 400 });

  // Create the order + items in a transaction
  const order = await db.$transaction(async (tx) => {
    const created = await tx.customerOrder.create({
      data: {
        restaurantId,
        tableId: table.id,
        status: "SUBMITTED",
        notes: notes ?? null,
      },
    });
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      await tx.customerOrderItem.create({
        data: {
          orderId: created.id,
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPriceMinor: product.priceMinor,
          notes: item.notes ?? null,
        },
      });
    }
    return created;
  });

  return NextResponse.json({ order }, { status: 201 });
}
