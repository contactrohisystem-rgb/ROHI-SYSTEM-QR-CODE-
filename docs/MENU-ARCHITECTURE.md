# ROHI — Menu Management Architecture (Integration Plan)

## Status: Documented for next development milestone

This document defines the schema, API, and integration points for
restaurant-specific menu management. The existing billing system
(`POST /api/bills/[billId]/items`) accepts free-form item names + prices.
The menu system will provide a structured product catalogue that feeds into
the billing item-add flow, replacing the current preset catalog
(client-side `CATALOG` const in `billing-section.tsx`).

## Schema (Prisma)

```prisma
model MenuCategory {
  id           String   @id @default(cuid())
  restaurantId String
  name         String   // "Bebidas", "Pratos", "Sobremesas"
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  products    Product[]

  @@index([restaurantId, sortOrder])
}

model Product {
  id           String    @id @default(cuid())
  restaurantId String
  categoryId   String
  name         String
  description  String?
  priceMinor   Int       // integer minor units (centavos)
  imageUrl     String?
  available    Boolean   @default(true)
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  restaurant   Restaurant     @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  category     MenuCategory   @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([restaurantId, categoryId])
  @@index([restaurantId, available])
}
```

## API

- `GET /api/menu` — categories + products for the active restaurant.
- `POST/PATCH/DELETE /api/menu/categories/[id]` — category CRUD (MANAGER+).
- `POST/PATCH/DELETE /api/menu/products/[id]` — product CRUD (MANAGER+).
- The existing `POST /api/bills/[billId]/items` stays unchanged; the billing
  UI sends `{ name, quantity, unitPrice }` from the selected product.

## Integration

1. The Billing section's quick-add catalog (`billing-section.tsx`) fetches
   `GET /api/menu` instead of using the hardcoded `CATALOG` const.
2. Category tabs come from `MenuCategory`; item buttons from `Product`.
3. Custom item entry stays (for ad-hoc items not in the catalogue).
4. A "Menu" settings section manages categories + products (CRUD UI).

## Tenant isolation

Every `MenuCategory` and `Product` carries `restaurantId`. All API routes
enforce `requireStaffRole` + restaurant scoping. A restaurant never sees
another's menu.
