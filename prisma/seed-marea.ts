import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { generateOpaqueToken } from "../src/lib/tokens";

/**
 * MARÉA — Coastal Dining, Maputo. Luxury single-restaurant prototype seed.
 *
 * Creates the MARÉA restaurant with the full premium menu (Mozambican +
 * international), a realistic floor plan (Main Dining / Ocean Terrace /
 * Private Dining), kitchen stations, sample reservations, sample orders in
 * varied prep states, and a few open bills.
 *
 * Idempotent: wipes MARÉA's own operational data on each run and recreates it.
 * Does NOT touch other restaurants' data. To focus the prototype on MARÉA,
 * removes the demo owner's memberships to the other demo restaurants (the
 * switcher auto-hides when only one membership remains). Multi-tenant
 * architecture is fully preserved internally.
 *
 * Run with: bun run prisma/seed-marea.ts  (or bun run db:seed after updating)
 */

const MAREA_ID = "marea-maputo";
const OWNER_ID = "demo-owner";
const DEMO_PASSWORD = "demo1234";

const OPENING_HOURS = JSON.stringify({
  mon: { open: "12:00", close: "23:00" },
  tue: { open: "12:00", close: "23:00" },
  wed: { open: "12:00", close: "23:00" },
  thu: { open: "12:00", close: "23:59" },
  fri: { open: "12:00", close: "23:59" },
  sat: { open: "12:00", close: "23:59" },
  sun: { open: "12:00", close: "22:00" },
});

// Unsplash food photography (verified stable URLs).
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=500&h=350&fit=crop&q=80`;
const IMG = {
  ceviche: U("1559847844-5315695dadae"),
  steak: U("1546964124-0cce460f38ef"),
  pasta: U("1551183053-bf91a1d81141"),
  dessert: U("1551024601-bec78aea704b"),
  cocktail: U("1551538827-9c037cb4f32a"),
  burrata: U("1565299585323-38d6b0865b47"),
  soup: U("1547573854-74d2a71d0826"),
  salmon: U("1467003909585-2f8a72700288"),
  lamb: U("1544025162-d76694265947"),
  juice: U("1622597467836-f3285f2131b8"),
  bowl: U("1546069901-ba9599a7e63c"),
  coffee: U("1567620832903-9fc6debc209f"),
  signature: "/marea-signature.png",
};

// ────────────────────────────────────────────────────────────────────────────
// Menu catalogue — prices in MT (meticais). Minor units = MT × 100.
// ────────────────────────────────────────────────────────────────────────────

interface DishSeed {
  name: string; nameEn: string;
  desc: string; descEn: string;
  priceMT: number; img: string; featured?: boolean; station?: string;
}

const MENU: { category: string; categoryEn: string; dishes: DishSeed[] }[] = [
  {
    category: "Entradas", categoryEn: "Starters",
    dishes: [
      { name: "Ostras no Gelo", nameEn: "Oysters on Ice", desc: "6 ostras frescas, vinagrete cítrico e chalota mignonette.", descEn: "Fresh oysters, citrus dressing and shallot mignonette.", priceMT: 1250, img: IMG.burrata },
      { name: "Ceviche de Camarão", nameEn: "Prawn Ceviche", desc: "Camarões moçambicanos, lima, coentros, cebola roxa e abacate.", descEn: "Mozambican prawns, lime, coriander, red onion and avocado.", priceMT: 950, img: IMG.ceviche },
      { name: "Carpaccio de Polvo", nameEn: "Octopus Carpaccio", desc: "Polvo finamente fatiado, alcaparras, citrinos e azeite extra-virgem.", descEn: "Thinly sliced octopus, capers, citrus and extra virgin olive oil.", priceMT: 1150, img: IMG.ceviche },
      { name: "Burrata & Tomate", nameEn: "Burrata & Tomato", desc: "Burrata cremosa, tomates heirloom, manjericão e balsâmico envelhecido.", descEn: "Creamy burrata, heirloom tomatoes, basil and aged balsamic.", priceMT: 1250, img: IMG.burrata },
      { name: "Croquetes de Caranguejo", nameEn: "Crab Croquettes", desc: "Croquetes de caranguejo, maionese de ervas e limão.", descEn: "Crab croquettes, herb mayonnaise and lemon.", priceMT: 1050, img: IMG.bowl },
      { name: "Sopa de Marisco", nameEn: "Seafood Soup", desc: "Sopa rica de marisco com peixe local, camarões e ervas.", descEn: "Rich seafood soup with local fish, prawns and herbs.", priceMT: 950, img: IMG.soup },
    ],
  },
  {
    category: "Do Mar", categoryEn: "From the Ocean",
    dishes: [
      { name: "Camarão Tigre à MARÉA", nameEn: "MARÉA Tiger Prawns", desc: "Camarões tigre grelhados no carvão, manteiga de alho, limão e peri-peri da casa.", descEn: "Charcoal-grilled tiger prawns, garlic butter, lemon and house peri-peri.", priceMT: 2850, img: IMG.ceviche, featured: true, station: "Grelha" },
      { name: "Lagosta Grelhada", nameEn: "Grilled Lobster", desc: "Lagosta grelhada, manteiga fumada, vegetais da época e limão.", descEn: "Grilled lobster, smoked butter, seasonal vegetables and lemon.", priceMT: 3500, img: IMG.signature, featured: true, station: "Grelha" },
      { name: "Polvo à Lagareiro", nameEn: "Octopus Lagareiro", desc: "Polvo lentamente cozinhado, batatas baby assadas, azeite e paprika fumada.", descEn: "Slow-cooked octopus, roasted baby potatoes, olive oil and smoked paprika.", priceMT: 1850, img: IMG.ceviche, station: "Cozinha Principal" },
      { name: "Cataplana do Índico", nameEn: "Indian Ocean Cataplana", desc: "Camarões, mexilhões, lulas e peixe local em caldo de açafrão e tomate.", descEn: "Prawns, mussels, calamari and local fish in saffron tomato broth.", priceMT: 2450, img: IMG.bowl, featured: true, station: "Cozinha Principal" },
      { name: "Filete de Garoupa", nameEn: "Grouper Fillet", desc: "Garoupa salteada, arroz de coco, legumes e beurre blanc de lima.", descEn: "Pan-seared grouper, coconut rice, greens and lime beurre blanc.", priceMT: 2150, img: IMG.salmon, station: "Grelha" },
      { name: "Peixe do Dia", nameEn: "Catch of the Day", desc: "Pesca local fresca, preparação sazonal do chef e vegetais do mercado.", descEn: "Fresh local catch, chef's seasonal preparation and market vegetables.", priceMT: 1950, img: IMG.salmon, station: "Grelha" },
      { name: "Arroz de Marisco", nameEn: "Seafood Rice", desc: "Arroz de marisco à portuguesa com camarões, mexilhões e lulas.", descEn: "Portuguese-inspired seafood rice with prawns, mussels and calamari.", priceMT: 2200, img: IMG.bowl, station: "Cozinha Principal" },
      { name: "Lulas Grelhadas", nameEn: "Grilled Calamari", desc: "Lulas grelhadas, alho, limão, ervas e batatas assadas.", descEn: "Grilled calamari, garlic, lemon, herbs and roasted potatoes.", priceMT: 1550, img: IMG.ceviche, station: "Grelha" },
    ],
  },
  {
    category: "Da Grelha", categoryEn: "From the Grill",
    dishes: [
      { name: "Frango Piri-Piri", nameEn: "Peri-Peri Chicken", desc: "Meio frango grelhado no carvão, peri-peri caseiro e batatas rústicas.", descEn: "Half charcoal-grilled chicken, homemade peri-peri and rustic potatoes.", priceMT: 1450, img: IMG.bowl, station: "Grelha" },
      { name: "Filetto de Vaca", nameEn: "Beef Fillet", desc: "Filete de vaca, puré de batata, vegetais da época e jus de vinho tinto.", descEn: "Beef fillet, potato purée, seasonal vegetables and red wine jus.", priceMT: 2450, img: IMG.steak, station: "Grelha" },
      { name: "Picanha Angus", nameEn: "Angus Picanha", desc: "Picanha Angus grelhada, chimichurri e batatas assadas.", descEn: "Grilled premium beef, chimichurri and roasted potatoes.", priceMT: 2350, img: IMG.steak, station: "Grelha" },
      { name: "Costeletas de Borrego", nameEn: "Lamb Cutlets", desc: "Costeletas de borrego, jus de alecrim e vegetais grelhados.", descEn: "Lamb cutlets, rosemary jus and grilled seasonal vegetables.", priceMT: 2650, img: IMG.lamb, station: "Grelha" },
      { name: "Bife & Camarão", nameEn: "Beef & Prawns", desc: "Filete de vaca com camarões tigre, manteiga de alho e arroz basmati.", descEn: "Beef fillet with king prawns, garlic butter and basmati rice.", priceMT: 3150, img: IMG.steak, featured: true, station: "Grelha" },
    ],
  },
  {
    category: "Cozinha Internacional", categoryEn: "International Kitchen",
    dishes: [
      { name: "Risotto de Cogumelos", nameEn: "Mushroom Risotto", desc: "Arroz arbóreo, cogumelos selvagens, parmesão e óleo de trufa.", descEn: "Arborio rice, wild mushrooms, parmesan and truffle oil.", priceMT: 1450, img: IMG.bowl, station: "Cozinha Principal" },
      { name: "Tagliatelle de Marisco", nameEn: "Seafood Tagliatelle", desc: "Massa fresca, camarões, mexilhões, alho e tomate.", descEn: "Fresh pasta, prawns, mussels, garlic and tomato.", priceMT: 1650, img: IMG.pasta, station: "Cozinha Principal" },
      { name: "Ravioli de Ricotta", nameEn: "Ricotta Ravioli", desc: "Ravioli artesanal de ricotta, manteiga de salva e parmesão.", descEn: "Handmade ricotta ravioli, sage butter and parmesan.", priceMT: 1350, img: IMG.pasta, station: "Cozinha Principal" },
      { name: "Salmão Teriyaki", nameEn: "Salmon Teriyaki", desc: "Salmão salteado, sésamo, vegetais e arroz jasmim.", descEn: "Pan-seared salmon, sesame, vegetables and jasmine rice.", priceMT: 1950, img: IMG.salmon, station: "Grelha" },
      { name: "Perna de Borrego", nameEn: "Lamb Shank", desc: "Borrego estufado lentamente, puré cremoso de batata e jus de alecrim.", descEn: "Slow-braised lamb, creamy potato purée and rosemary jus.", priceMT: 2750, img: IMG.lamb, station: "Cozinha Principal" },
    ],
  },
  {
    category: "Sobremesas", categoryEn: "Desserts",
    dishes: [
      { name: "Fondant de Chocolate", nameEn: "Chocolate Fondant", desc: "Centro quente de chocolate negro e gelado de baunilha.", descEn: "Warm dark chocolate centre and vanilla ice cream.", priceMT: 650, img: IMG.dessert, station: "Sobremesas" },
      { name: "Pastel de Nata", nameEn: "Portuguese Custard Tart", desc: "Pastel de nata, canela e baunilha.", descEn: "Portuguese custard tart, cinnamon and vanilla.", priceMT: 450, img: IMG.dessert, station: "Pastelaria" },
      { name: "Crème Brûlée", nameEn: "Crème Brûlée", desc: "Creme de baunilha e açúcar caramelizado.", descEn: "Vanilla custard and caramelised sugar.", priceMT: 550, img: IMG.dessert, station: "Sobremesas" },
      { name: "Cheesecake de Maracujá", nameEn: "Passion Fruit Cheesecake", desc: "Cheesecake de maracujá com coulis tropical.", descEn: "Passion fruit cheesecake with tropical coulis.", priceMT: 650, img: IMG.dessert, station: "Sobremesas" },
      { name: "Tarte de Coco", nameEn: "Coconut Tart", desc: "Tarte de coco, manga e lima.", descEn: "Coconut tart, mango and lime.", priceMT: 550, img: IMG.dessert, station: "Pastelaria" },
      { name: "Seleção de Fruta Fresca", nameEn: "Fresh Fruit Selection", desc: "Seleção de fruta tropical da época.", descEn: "Seasonal tropical fruit selection.", priceMT: 450, img: IMG.dessert, station: "Pastelaria" },
    ],
  },
  {
    category: "Bebidas", categoryEn: "Drinks",
    dishes: [
      { name: "Sumo de Maracujá", nameEn: "Fresh Passion Fruit Juice", desc: "Sumo natural de maracujá.", descEn: "Fresh passion fruit juice.", priceMT: 350, img: IMG.juice, station: "Bar" },
      { name: "Sumo de Manga", nameEn: "Fresh Mango Juice", desc: "Sumo natural de manga.", descEn: "Fresh mango juice.", priceMT: 350, img: IMG.juice, station: "Bar" },
      { name: "Limonada Caseira", nameEn: "Homemade Lemonade", desc: "Limonada fresca da casa.", descEn: "Homemade fresh lemonade.", priceMT: 300, img: IMG.juice, station: "Bar" },
      { name: "Água Mineral", nameEn: "Still Water", desc: "Água mineral natural.", descEn: "Still mineral water.", priceMT: 150, img: IMG.juice, station: "Bar" },
      { name: "Água com Gás", nameEn: "Sparkling Water", desc: "Água mineral com gás.", descEn: "Sparkling mineral water.", priceMT: 250, img: IMG.juice, station: "Bar" },
      { name: "Espresso", nameEn: "Espresso", desc: "Café espresso.", descEn: "Espresso coffee.", priceMT: 200, img: IMG.coffee, station: "Bar" },
      { name: "Cappuccino", nameEn: "Cappuccino", desc: "Cappuccino cremoso.", descEn: "Creamy cappuccino.", priceMT: 350, img: IMG.coffee, station: "Bar" },
      { name: "Chá de Hortelã", nameEn: "Fresh Mint Tea", desc: "Chá fresco de hortelã.", descEn: "Fresh mint tea.", priceMT: 250, img: IMG.coffee, station: "Bar" },
    ],
  },
  {
    category: "Cocktails", categoryEn: "Cocktails",
    dishes: [
      { name: "MARÉA Sunset", nameEn: "MARÉA Sunset", desc: "Maracujá, citrinos, baunilha e rum premium.", descEn: "Passion fruit, citrus, vanilla and premium rum.", priceMT: 750, img: IMG.cocktail, featured: true, station: "Bar" },
      { name: "Maputo Mule", nameEn: "Maputo Mule", desc: "Vodka, gengibre, lima e hortelã.", descEn: "Vodka, ginger, lime and mint.", priceMT: 650, img: IMG.cocktail, station: "Bar" },
      { name: "Indian Ocean Martini", nameEn: "Indian Ocean Martini", desc: "Gin, vermute seco e citrinos.", descEn: "Gin, dry vermouth and citrus.", priceMT: 800, img: IMG.cocktail, featured: true, station: "Bar" },
      { name: "Coconut Mojito", nameEn: "Coconut Mojito", desc: "Rum branco, hortelã fresca, lima e coco.", descEn: "White rum, fresh mint, lime and coconut.", priceMT: 650, img: IMG.cocktail, station: "Bar" },
      { name: "Virgin Tropical Spritz", nameEn: "Virgin Tropical Spritz", desc: "Manga, maracujá, lima e água com gás.", descEn: "Mango, passion fruit, lime and sparkling water.", priceMT: 450, img: IMG.cocktail, station: "Bar" },
    ],
  },
  {
    category: "Experiências", categoryEn: "Signature Experiences",
    dishes: [
      { name: "MARÉA Signature Seafood", nameEn: "MARÉA Signature Seafood Experience", desc: "Experiência de marisco curada para dois — seleção do chef.", descEn: "Curated seafood selection for two — chef's selection.", priceMT: 5500, img: IMG.signature, featured: true, station: "Cozinha Principal" },
      { name: "Taste of Mozambique", nameEn: "Taste of Mozambique", desc: "Menu de três pratos celebrando ingredientes locais e sabores moçambicanos.", descEn: "Three-course experience celebrating local ingredients and Mozambican flavours.", priceMT: 4500, img: IMG.signature, featured: true, station: "Cozinha Principal" },
      { name: "Chef's Tasting Journey", nameEn: "Chef's Tasting Journey", desc: "Menu de degustação premium de cinco pratos.", descEn: "Premium five-course tasting menu.", priceMT: 6500, img: IMG.signature, featured: true, station: "Cozinha Principal" },
    ],
  },
];

const STATIONS = ["Cozinha Principal", "Grelha", "Bar", "Sobremesas", "Pastelaria"];

const TABLES = [
  // Main Dining
  { label: "T1", area: "Main Dining", shape: "round", seats: 2, posX: 18, posY: 30, width: 60, height: 60 },
  { label: "T2", area: "Main Dining", shape: "round", seats: 4, posX: 45, posY: 25, width: 64, height: 64 },
  { label: "T3", area: "Main Dining", shape: "round", seats: 4, posX: 75, posY: 30, width: 64, height: 64 },
  { label: "T4", area: "Main Dining", shape: "rect", seats: 6, posX: 25, posY: 65, width: 100, height: 56 },
  { label: "T5", area: "Main Dining", shape: "square", seats: 2, posX: 70, posY: 68, width: 54, height: 54 },
  // Ocean Terrace
  { label: "O1", area: "Ocean Terrace", shape: "round", seats: 4, posX: 25, posY: 30, width: 64, height: 64 },
  { label: "O2", area: "Ocean Terrace", shape: "round", seats: 4, posX: 60, posY: 30, width: 64, height: 64 },
  { label: "O3", area: "Ocean Terrace", shape: "rect", seats: 8, posX: 40, posY: 65, width: 120, height: 50 },
  // Private Dining
  { label: "P1", area: "Private Dining", shape: "round", seats: 8, posX: 30, posY: 40, width: 80, height: 80 },
  { label: "P2", area: "Private Dining", shape: "rect", seats: 10, posX: 65, posY: 45, width: 120, height: 60 },
];

function daysAgoDate(n: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d;
}

async function main() {
  // --- MARÉA restaurant ---
  const restaurant = await db.restaurant.upsert({
    where: { id: MAREA_ID },
    update: {
      name: "MARÉA",
      legalName: "MARÉA Coastal Dining Lda",
      currency: "MZN",
      locale: "pt-MZ",
      timezone: "Africa/Maputo",
      status: "active",
      phone: "+258 840 000 000",
      address: "Av. Marginal, Maputo, Mozambique",
      brandPrimary: "#173C32",
      brandSecondary: "#102B25",
      brandAccent: "#C6A66B",
      appearance: "dark",
      logoUrl: null,
      coverUrl: "/marea-cover.png",
      slug: "marea",
      description: "Coastal dining in Maputo — where the Indian Ocean is served differently. A fictional premium restaurant combining the flavours of Mozambique with contemporary international cuisine.",
      openingHours: OPENING_HOURS,
      reservationsEnabled: true,
      defaultReservationDurationMins: 120,
      minNoticeMins: 90,
      maxAdvanceDays: 60,
      maxPartySize: 12,
      reservationApprovalMode: "STAFF",
      reservationCancellationPolicy: "Cancelamento gratuito até 2 horas antes da reserva.",
    },
    create: {
      id: MAREA_ID,
      name: "MARÉA",
      legalName: "MARÉA Coastal Dining Lda",
      currency: "MZN",
      locale: "pt-MZ",
      timezone: "Africa/Maputo",
      status: "active",
      phone: "+258 840 000 000",
      address: "Av. Marginal, Maputo, Mozambique",
      brandPrimary: "#173C32",
      brandSecondary: "#102B25",
      brandAccent: "#C6A66B",
      appearance: "dark",
      coverUrl: "/marea-cover.png",
      slug: "marea",
      description: "Coastal dining in Maputo — where the Indian Ocean is served differently. A fictional premium restaurant combining the flavours of Mozambique with contemporary international cuisine.",
      openingHours: OPENING_HOURS,
      reservationsEnabled: true,
      defaultReservationDurationMins: 120,
      minNoticeMins: 90,
      maxAdvanceDays: 60,
      maxPartySize: 12,
      reservationApprovalMode: "STAFF",
      reservationCancellationPolicy: "Cancelamento gratuito até 2 horas antes da reserva.",
    },
  });

  // --- Owner + membership ---
  await db.user.upsert({
    where: { email: "owner@rohi.demo" },
    update: {},
    create: {
      id: OWNER_ID,
      email: "owner@rohi.demo",
      name: "MARÉA Manager",
      passwordHash: hashPassword(DEMO_PASSWORD),
      platformRole: "NONE",
    },
  });
  await db.restaurantStaff.upsert({
    where: { userId_restaurantId: { userId: OWNER_ID, restaurantId: MAREA_ID } },
    update: { role: "OWNER" },
    create: { userId: OWNER_ID, restaurantId: MAREA_ID, role: "OWNER" },
  });
  // Remove the owner's memberships to the other demo restaurants so the
  // prototype shows a single restaurant (switcher auto-hides). The other
  // restaurants and their data are preserved.
  await db.restaurantStaff.deleteMany({
    where: { userId: OWNER_ID, restaurantId: { not: MAREA_ID } },
  });

  // --- Reset MARÉA operational data (idempotent) ---
  await db.posSyncRecord.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.payment.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.bill.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.customerOrderItem.deleteMany({ where: { order: { restaurantId: MAREA_ID } } });
  await db.customerOrder.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.reservation.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.restaurantTable.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.area.deleteMany({ where: { floorPlan: { restaurantId: MAREA_ID } } });
  await db.floorPlan.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.product.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.menuCategory.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.kitchenStation.deleteMany({ where: { restaurantId: MAREA_ID } });
  await db.posConnection.deleteMany({ where: { restaurantId: MAREA_ID } });

  // --- Kitchen stations ---
  const stationMap = new Map<string, string>();
  for (const [i, name] of STATIONS.entries()) {
    const s = await db.kitchenStation.create({ data: { restaurantId: MAREA_ID, name, sortOrder: i } });
    stationMap.set(name, s.id);
  }

  // --- Floor plan + areas + tables ---
  const fp = await db.floorPlan.create({ data: { restaurantId: MAREA_ID, name: "MARÉA Floor", sortOrder: 0 } });
  const areaMap = new Map<string, string>();
  for (const [i, areaName] of ["Main Dining", "Ocean Terrace", "Private Dining"].entries()) {
    const a = await db.area.create({ data: { floorPlanId: fp.id, name: areaName, sortOrder: i } });
    areaMap.set(areaName, a.id);
  }
  const tableMap = new Map<string, string>();
  for (const t of TABLES) {
    const created = await db.restaurantTable.create({
      data: {
        restaurantId: MAREA_ID,
        label: t.label,
        area: t.area,
        areaId: areaMap.get(t.area) ?? null,
        token: generateOpaqueToken("tbl", 16),
        status: "AVAILABLE",
        shape: t.shape,
        seats: t.seats,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
      },
    });
    tableMap.set(t.label, created.id);
  }

  // --- Menu categories + products ---
  const productNameById = new Map<string, { id: string; priceMinor: number; kitchenStationId: string | null }>();
  for (const [ci, cat] of MENU.entries()) {
    const c = await db.menuCategory.create({
      data: { restaurantId: MAREA_ID, name: cat.category, sortOrder: ci },
    });
    for (const [di, dish] of cat.dishes.entries()) {
      const stationId = dish.station ? stationMap.get(dish.station) ?? null : null;
      const p = await db.product.create({
        data: {
          restaurantId: MAREA_ID,
          categoryId: c.id,
          name: dish.name,
          nameEn: dish.nameEn,
          description: dish.desc,
          descriptionEn: dish.descEn,
          priceMinor: dish.priceMT * 100,
          imageUrl: dish.img,
          featured: dish.featured ?? false,
          kitchenStationId: stationId,
          sortOrder: di,
        },
      });
      productNameById.set(dish.name, { id: p.id, priceMinor: p.priceMinor, kitchenStationId: p.kitchenStationId });
    }
  }

  // --- Open bills on a few tables (with items) ---
  const openBillSpecs: [string, [string, number][]][] = [
    ["T2", [["Camarão Tigre à MARÉA", 1], ["MARÉA Sunset", 2]]],
    ["O1", [["Lagosta Grelhada", 1], ["Pastel de Nata", 2], ["Água Mineral", 2]]],
    ["P1", [["Chef's Tasting Journey", 2], ["Indian Ocean Martini", 2]]],
  ];
  for (const [tableLabel, items] of openBillSpecs) {
    const tableId = tableMap.get(tableLabel)!;
    const subtotal = items.reduce((s, [name, q]) => {
      const p = productNameById.get(name)!;
      return s + q * p.priceMinor;
    }, 0);
    const service = Math.round(subtotal * 0.1);
    const bill = await db.bill.create({
      data: {
        restaurantId: MAREA_ID, tableId, source: "NATIVE", status: "OPEN",
        currency: "MZN", subtotalMinor: 0, adjustmentTotalMinor: 0, totalMinor: 0,
      },
    });
    for (const [name, qty] of items) {
      const p = productNameById.get(name)!;
      await db.billItem.create({
        data: { billId: bill.id, name, quantity: qty, unitPriceMinor: p.priceMinor, totalMinor: qty * p.priceMinor },
      });
    }
    await db.billAdjustment.create({ data: { billId: bill.id, type: "SERVICE", label: "Serviço 10%", amountMinor: service } });
    await db.bill.update({
      where: { id: bill.id },
      data: { subtotalMinor: subtotal, adjustmentTotalMinor: service, totalMinor: subtotal + service },
    });
    await db.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
  }

  // --- Sample customer order in PREPARING (for the KDS) ---
  const orderTableId = tableMap.get("T4")!;
  const order = await db.customerOrder.create({
    data: {
      restaurantId: MAREA_ID,
      tableId: orderTableId,
      status: "PREPARING",
      notes: "Sem piri-piri no frango",
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });
  const orderItems: [string, number, string][] = [
    ["Frango Piri-Piri", 2, "PREPARING"],
    ["Ceviche de Camarão", 1, "READY"],
    ["Bife & Camarão", 1, "NEW"],
    ["MARÉA Sunset", 2, "READY"],
  ];
  for (const [name, qty, prep] of orderItems) {
    const p = productNameById.get(name)!;
    await db.customerOrderItem.create({
      data: {
        orderId: order.id,
        productId: p.id,
        name,
        quantity: qty,
        unitPriceMinor: p.priceMinor,
        prepStatus: prep,
        kitchenStationId: p.kitchenStationId,
      },
    });
  }
  // A second demo order, ACCEPTED.
  const order2 = await db.customerOrder.create({
    data: {
      restaurantId: MAREA_ID,
      tableId: tableMap.get("O2")!,
      status: "ACCEPTED",
      createdAt: new Date(Date.now() - 90 * 1000),
    },
  });
  for (const [name, qty] of [["Cataplana do Índico", 1], ["Coconut Mojito", 2]] as [string, number][]) {
    const p = productNameById.get(name)!;
    await db.customerOrderItem.create({
      data: {
        orderId: order2.id,
        productId: p.id,
        name,
        quantity: qty,
        unitPriceMinor: p.priceMinor,
        prepStatus: "NEW",
        kitchenStationId: p.kitchenStationId,
      },
    });
  }

  // --- Sample reservations ---
  const inOneHour = new Date(Date.now() + 1 * 60 * 60 * 1000);
  const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const tomorrowEvening = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrowEvening.setHours(20, 0, 0, 0);
  const rsvSpecs = [
    { name: "Sofia Mondlane", phone: "+258841234567", party: 4, date: inOneHour, area: "Ocean Terrace", notes: "Janela com vista para o mar", status: "CONFIRMED", table: "O2", ref: "RSV-SMO4K2", duration: 120 },
    { name: "Ricardo Tamele", phone: "+258842345678", party: 2, date: inThreeHours, area: "Main Dining", notes: null, status: "PENDING", table: null, ref: "RSV-RTA9M5", duration: 90 },
    { name: "Família Cossa", phone: "+258843456789", party: 8, date: tomorrowEvening, area: "Private Dining", notes: "Aniversário — bolo no fim", status: "PENDING", table: null, ref: "RSV-FCO8Q3", duration: 180 },
  ];
  for (const r of rsvSpecs) {
    await db.reservation.create({
      data: {
        restaurantId: MAREA_ID,
        tableId: r.table ? tableMap.get(r.table) ?? null : null,
        customerName: r.name,
        phone: r.phone,
        partySize: r.party,
        date: r.date,
        durationMins: r.duration,
        areaPreference: r.area,
        notes: r.notes,
        status: r.status,
        reference: r.ref,
      },
    });
  }

  // --- POS connection (MOCK) ---
  await db.posConnection.create({
    data: { restaurantId: MAREA_ID, adapterCode: "MOCK", status: "ACTIVE", lastSyncAt: daysAgoDate(0, 12) },
  });

  console.log("MARÉA seed complete.");
  console.log(`  Restaurant: ${restaurant.name} (slug: ${restaurant.slug})`);
  console.log(`  Menu: ${MENU.reduce((s, c) => s + c.dishes.length, 0)} dishes across ${MENU.length} categories`);
  console.log(`  Tables: ${TABLES.length} across Main Dining / Ocean Terrace / Private Dining`);
  console.log(`  Stations: ${STATIONS.length}`);
  console.log(`  Reservations: ${rsvSpecs.length}`);
  console.log(`  Owner: owner@rohi.demo / ${DEMO_PASSWORD} (OWNER, single restaurant)`);
}

main()
  .catch((e) => {
    console.error("MARÉA seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
