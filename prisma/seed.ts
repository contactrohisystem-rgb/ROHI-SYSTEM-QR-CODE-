import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { generateOpaqueToken } from "../src/lib/tokens";

/**
 * ROHI development seed.
 *
 * Creates a rich demo restaurant ("Restaurante Demo Maputo") with multiple
 * tables across areas, open bills, and ~10 days of historical SUCCEEDED
 * payments (via MockProvider — clearly DEMO data) so the dashboard analytics
 * look realistic.
 *
 * Idempotent: wipes the demo restaurant's operational data (tables, bills,
 * payments, sync records) on each run and recreates it. Users + memberships
 * are upserted (preserved).
 *
 * Run with: bun run db:seed
 */

const RESTAURANT_ID = "demo-rest-maputo";
const OWNER_ID = "demo-owner";
const MANAGER_ID = "demo-manager";
const DEMO_PASSWORD = "demo1234";

const TABLES = [
  { label: "Mesa 1", area: "Interior", shape: "round", seats: 4, posX: 20, posY: 30 },
  { label: "Mesa 2", area: "Interior", shape: "square", seats: 2, posX: 55, posY: 25 },
  { label: "Mesa 3", area: "Interior", shape: "round", seats: 4, posX: 20, posY: 70 },
  { label: "Mesa 4", area: "Interior", shape: "rect", seats: 6, posX: 62, posY: 68 },
  { label: "Mesa 5", area: "Terraço", shape: "round", seats: 4, posX: 30, posY: 35 },
  { label: "Mesa 6", area: "Terraço", shape: "square", seats: 2, posX: 70, posY: 45 },
  { label: "Mesa 7", area: "VIP", shape: "round", seats: 6, posX: 45, posY: 45 },
];

// Historical paid bills: [daysAgo, amountMinor, tableLabel]
const HISTORY: { daysAgo: number; amountMinor: number; table: string }[] = [
  { daysAgo: 6, amountMinor: 1450, table: "Mesa 1" },
  { daysAgo: 6, amountMinor: 820, table: "Mesa 5" },
  { daysAgo: 5, amountMinor: 2100, table: "Mesa 4" },
  { daysAgo: 5, amountMinor: 670, table: "Mesa 2" },
  { daysAgo: 4, amountMinor: 1850, table: "Mesa 7" },
  { daysAgo: 3, amountMinor: 980, table: "Mesa 3" },
  { daysAgo: 3, amountMinor: 1320, table: "Mesa 6" },
  { daysAgo: 2, amountMinor: 2480, table: "Mesa 4" },
  { daysAgo: 1, amountMinor: 1180, table: "Mesa 1" },
  { daysAgo: 1, amountMinor: 760, table: "Mesa 5" },
  { daysAgo: 0, amountMinor: 1620, table: "Mesa 7" },
  { daysAgo: 0, amountMinor: 540, table: "Mesa 2" },
];

function daysAgoDate(n: number, hour = 13): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d;
}

async function main() {
  // --- Restaurant + users (upsert) ---
  const restaurant = await db.restaurant.upsert({
    where: { id: RESTAURANT_ID },
    update: {},
    create: {
      id: RESTAURANT_ID,
      name: "Restaurante Demo Maputo",
      legalName: "Demo Maputo Lda",
      currency: "MZN",
      locale: "pt-MZ",
      timezone: "Africa/Maputo",
      status: "active",
    },
  });

  const owner = await db.user.upsert({
    where: { email: "owner@rohi.demo" },
    update: {},
    create: {
      id: OWNER_ID,
      email: "owner@rohi.demo",
      name: "Demo Owner",
      passwordHash: hashPassword(DEMO_PASSWORD),
      platformRole: "NONE",
    },
  });

  const manager = await db.user.upsert({
    where: { email: "manager@rohi.demo" },
    update: {},
    create: {
      id: MANAGER_ID,
      email: "manager@rohi.demo",
      name: "Demo Manager",
      passwordHash: hashPassword(DEMO_PASSWORD),
      platformRole: "NONE",
    },
  });

  await db.restaurantStaff.upsert({
    where: {
      userId_restaurantId: { userId: OWNER_ID, restaurantId: RESTAURANT_ID },
    },
    update: {},
    create: { userId: OWNER_ID, restaurantId: RESTAURANT_ID, role: "OWNER" },
  });
  await db.restaurantStaff.upsert({
    where: {
      userId_restaurantId: { userId: MANAGER_ID, restaurantId: RESTAURANT_ID },
    },
    update: {},
    create: { userId: MANAGER_ID, restaurantId: RESTAURANT_ID, role: "MANAGER" },
  });

  // --- Reset operational data for a clean, idempotent demo ---
  await db.posSyncRecord.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await db.payment.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await db.bill.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await db.restaurantTable.deleteMany({ where: { restaurantId: RESTAURANT_ID } });
  await db.posConnection.deleteMany({ where: { restaurantId: RESTAURANT_ID } });

  // --- Tables ---
  const tableMap = new Map<string, string>();
  for (const t of TABLES) {
    const created = await db.restaurantTable.create({
      data: {
        restaurantId: RESTAURANT_ID,
        label: t.label,
        area: t.area,
        token: generateOpaqueToken("tbl", 16),
        status: "AVAILABLE",
        shape: t.shape,
        seats: t.seats,
        posX: t.posX,
        posY: t.posY,
      },
    });
    tableMap.set(t.label, created.id);
  }

  // --- Open bills on a few tables (with items) ---
  for (const [label, items] of [
    ["Mesa 1", [["Cerveja 2M", 2, 7500], ["Cambarito", 1, 18000]]] as const,
    ["Mesa 4", [["Frango grelhado", 2, 25000], ["Refri", 3, 4000]]] as const,
    ["Mesa 7", [["Vinho", 1, 45000], ["Bolo", 1, 12000]]] as const,
  ]) {
    const tableId = tableMap.get(label)!;
    const subtotal = items.reduce((s, [, q, p]) => s + q * p, 0);
    const service = Math.round(subtotal * 0.1);
    const bill = await db.bill.create({
      data: {
        restaurantId: RESTAURANT_ID,
        tableId,
        source: "NATIVE",
        status: "OPEN",
        currency: "MZN",
        subtotalMinor: 0,
        adjustmentTotalMinor: 0,
        totalMinor: 0,
      },
    });
    for (const [name, qty, price] of items) {
      await db.billItem.create({
        data: { billId: bill.id, name, quantity: qty, unitPriceMinor: price, totalMinor: qty * price },
      });
    }
    await db.billAdjustment.create({
      data: { billId: bill.id, type: "SERVICE", label: "Serviço 10%", amountMinor: service },
    });
    await db.bill.update({
      where: { id: bill.id },
      data: { subtotalMinor: subtotal, adjustmentTotalMinor: service, totalMinor: subtotal + service },
    });
    await db.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
  }

  // --- Historical paid bills + payments (spread over 7 days) ---
  for (const h of HISTORY) {
    const tableId = tableMap.get(h.table)!;
    const paid = daysAgoDate(h.daysAgo);
    const bill = await db.bill.create({
      data: {
        restaurantId: RESTAURANT_ID,
        tableId,
        source: "NATIVE",
        status: "PAID",
        currency: "MZN",
        subtotalMinor: h.amountMinor,
        adjustmentTotalMinor: 0,
        totalMinor: h.amountMinor,
        openedAt: new Date(paid.getTime() - 30 * 60 * 1000),
        closedAt: paid,
      },
    });
    await db.payment.create({
      data: {
        restaurantId: RESTAURANT_ID,
        billId: bill.id,
        providerCode: "MOCK",
        status: "SUCCEEDED",
        amountMinor: h.amountMinor,
        currency: "MZN",
        idempotencyKey: `bill_${bill.id}_MOCK_${Math.random().toString(36).slice(2, 8)}`,
        customerIdentifier: "****4567",
        providerPaymentId: `mock_${bill.id}_${Math.random().toString(36).slice(2, 8)}`,
        initiatedAt: new Date(paid.getTime() - 60 * 1000),
        confirmedAt: paid,
      },
    });
  }

  // --- One pending payment (on Mesa 3, open bill) ---
  const pendingTable = tableMap.get("Mesa 3")!;
  const pendingBill = await db.bill.create({
    data: {
      restaurantId: RESTAURANT_ID, tableId: pendingTable, source: "NATIVE", status: "OPEN",
      currency: "MZN", subtotalMinor: 9800, adjustmentTotalMinor: 0, totalMinor: 9800,
    },
  });
  await db.billItem.create({ data: { billId: pendingBill.id, name: "Lulas grelhadas", quantity: 1, unitPriceMinor: 9800, totalMinor: 9800 } });
  await db.payment.create({
    data: {
      restaurantId: RESTAURANT_ID, billId: pendingBill.id, providerCode: "MOCK", status: "INITIATED",
      amountMinor: 9800, currency: "MZN", idempotencyKey: `bill_${pendingBill.id}_MOCK_pending`,
      customerIdentifier: "****1234", providerPaymentId: `mock_${pendingBill.id}_pending`,
      initiatedAt: new Date(),
    },
  });
  await db.restaurantTable.update({ where: { id: pendingTable }, data: { status: "OCCUPIED" } });

  // --- One failed payment ---
  const failedTable = tableMap.get("Mesa 6")!;
  const failedBill = await db.bill.create({
    data: {
      restaurantId: RESTAURANT_ID, tableId: failedTable, source: "NATIVE", status: "OPEN",
      currency: "MZN", subtotalMinor: 5000, adjustmentTotalMinor: 0, totalMinor: 5000,
    },
  });
  await db.payment.create({
    data: {
      restaurantId: RESTAURANT_ID, billId: failedBill.id, providerCode: "MOCK", status: "FAILED",
      amountMinor: 5000, currency: "MZN", idempotencyKey: `bill_${failedBill.id}_MOCK_failed`,
      failedReason: "customer_declined", initiatedAt: daysAgoDate(0, 11),
    },
  });

  // --- POS connection (MOCK) + a sync record ---
  await db.posConnection.create({
    data: { restaurantId: RESTAURANT_ID, adapterCode: "MOCK", status: "ACTIVE", lastSyncAt: daysAgoDate(0, 12) },
  });
  const firstPaidBill = await db.bill.findFirst({
    where: { restaurantId: RESTAURANT_ID, status: "PAID" },
    orderBy: { closedAt: "desc" },
    select: { id: true, externalPosBillId: true },
  });
  if (firstPaidBill) {
    await db.posSyncRecord.create({
      data: {
        restaurantId: RESTAURANT_ID, billId: firstPaidBill.id, adapterCode: "MOCK",
        direction: "PAYMENT_CONFIRM", status: "SUCCEEDED", attempts: 1,
        lastAttemptAt: daysAgoDate(0, 12), externalResourceId: firstPaidBill.externalPosBillId,
      },
    });
  }

  console.log("ROHI seed complete.");
  console.log(`  Restaurant: ${restaurant.id} — ${restaurant.name}`);
  console.log(`  Tables: ${TABLES.length} across Interior/Terraço/VIP`);
  console.log(`  Historical payments: ${HISTORY.length} (last 7 days, MockProvider — demo)`);
  console.log(`  Owner:   ${owner.email} / ${DEMO_PASSWORD}  (OWNER)`);
  console.log(`  Manager: ${manager.email} / ${DEMO_PASSWORD}  (MANAGER)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
