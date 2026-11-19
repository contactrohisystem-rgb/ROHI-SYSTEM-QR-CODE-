import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";

/**
 * Development seed for ROHI.
 *
 * Creates one demo restaurant in Maputo + an OWNER and a MANAGER user so the
 * auth flow can be exercised end to end. These credentials are DEMO ONLY and
 * must never exist in a pilot/production database.
 *
 * Run with: bun run db:seed
 */

const RESTAURANT_ID = "demo-rest-maputo";
const OWNER_ID = "demo-owner";
const MANAGER_ID = "demo-manager";
const DEMO_PASSWORD = "demo1234";

async function main() {
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

  console.log("ROHI seed complete.");
  console.log(`  Restaurant: ${restaurant.id} — ${restaurant.name}`);
  console.log(`  Owner:    ${owner.email} / ${DEMO_PASSWORD}  (OWNER)`);
  console.log(`  Manager:  ${manager.email} / ${DEMO_PASSWORD}  (MANAGER)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
