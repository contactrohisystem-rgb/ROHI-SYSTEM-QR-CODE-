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
  tableToken: z.string().min(1).optional(),
  tableId: z.string().min(1).optional(),
  restaurantSlug: z.string().min(1).optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().min(1).max(50),
      notes: z.string().max(200).optional(),
    }),
  ).min(1),
  notes: z.string().max(500).optional(),
  // COD / delivery fields (only for DELIVERY orders).
  orderType: z.enum(["DINE_IN", "DELIVERY"]).optional(),
  customerName: z.string().max(80).optional(),
  customerPhone: z.string().max(30).optional(),
  deliveryAddress: z.string().max(300).optional(),
  deliveryInstructions: z.string().max(500).optional(),
});

/**
 * POST /api/orders — submit an order.
 * Three modes:
 *   Guest (table): { tableToken, items } — token-gated, no auth. Creates SUBMITTED.
 *   Guest (preorder): { restaurantSlug, items } — public landing-page preorder,
 *     no table. Creates SUBMITTED with tableId=null. The order appears in staff
 *     operations as a preorder (no table label).
 *   Staff: { tableId, items } — SERVER+, resolves the table from the caller's
 *          restaurant. Creates ACCEPTED (staff already confirmed with the
 *          customer) so the ticket goes straight to the KDS.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { tableToken, tableId, restaurantSlug, items, notes } = parsed.data;
  const orderType = parsed.data.orderType ?? "DINE_IN";

  // For DELIVERY (COD) orders, require delivery details.
  if (orderType === "DELIVERY") {
    if (!parsed.data.customerName || !parsed.data.customerPhone || !parsed.data.deliveryAddress) {
      return NextResponse.json({ error: "missing_delivery_details" }, { status: 400 });
    }
  }

  let restaurantId: string;
  let resolvedTableId: string | null;
  let initialStatus: string;

  if (tableToken) {
    // Guest mode (table QR)
    const table = await db.restaurantTable.findUnique({
      where: { token: tableToken },
      include: { restaurant: { select: { id: true, status: true } } },
    });
    if (!table || table.restaurant.status !== "active")
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    restaurantId = table.restaurant.id;
    resolvedTableId = table.id;
    initialStatus = "SUBMITTED";
  } else if (restaurantSlug) {
    // Guest mode (public landing-page preorder — no table)
    const restaurant = await db.restaurant.findFirst({
      where: { slug: restaurantSlug, status: "active" },
      select: { id: true },
    });
    if (!restaurant)
      return NextResponse.json({ error: "invalid_restaurant" }, { status: 404 });
    restaurantId = restaurant.id;
    resolvedTableId = null;
    initialStatus = "SUBMITTED";
  } else if (tableId) {
    // Staff mode
    const { requireStaffRole } = await import("@/lib/auth/session");
    const auth = await requireStaffRole("SERVER");
    if (!auth.ok) return auth.response;
    const table = await db.restaurantTable.findFirst({
      where: { id: tableId, restaurantId: auth.ctx.restaurantId },
      select: { id: true },
    });
    if (!table)
      return NextResponse.json({ error: "invalid_table" }, { status: 404 });
    restaurantId = auth.ctx.restaurantId;
    resolvedTableId = table.id;
    initialStatus = "ACCEPTED";
  } else {
    return NextResponse.json({ error: "missing_table_reference" }, { status: 400 });
  }

  // Fetch products from DB (validate availability + snapshot prices server-side)
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, restaurantId, available: true },
    select: { id: true, name: true, priceMinor: true, kitchenStationId: true },
  });
  if (products.length !== productIds.length)
    return NextResponse.json({ error: "product_unavailable" }, { status: 400 });

  // Create the order + items in a transaction. Stage 12D: snapshot the product's
  // kitchenStationId onto each item so KDS routing is preserved even if the
  // product's station is later changed or the product/station is deleted.
  const order = await db.$transaction(async (tx) => {
    const created = await tx.customerOrder.create({
      data: {
        restaurantId,
        tableId: resolvedTableId,
        status: initialStatus,
        notes: notes ?? null,
        orderType,
        customerName: orderType === "DELIVERY" ? parsed.data.customerName ?? null : null,
        customerPhone: orderType === "DELIVERY" ? parsed.data.customerPhone ?? null : null,
        deliveryAddress: orderType === "DELIVERY" ? parsed.data.deliveryAddress ?? null : null,
        deliveryInstructions: orderType === "DELIVERY" ? parsed.data.deliveryInstructions ?? null : null,
        deliveryFeeMinor: 0, // set by billing when the bill is opened
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
          kitchenStationId: product.kitchenStationId,
        },
      });
    }
    return created;
  });

  return NextResponse.json({ order }, { status: 201 });
}
