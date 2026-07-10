# Step 2 — Inventory Ledger + Status History (schema delta) — DRAFT FOR REVIEW

Status: **proposed, not applied.** No `schema.prisma` edit and no migration has been
run. This is the design to approve before touching the DB.

Implements plan decisions **D2** (single source of truth for stock), **D3** (reserve →
deduct → release lifecycle), **D4** (order status history), **D5** (webhook idempotency).
Scope is deliberately **additive** — 4 new tables + 1 enum + back-relations — so nothing
existing breaks. Enum realignment and the service rewire are separate, sequenced follow-ups
(see §5–§6).

---

## 1. New enum

```prisma
enum MovementType {
  INITIAL     // opening balance when an inventory row is created
  RESERVE     // order placed:            reserved += qty
  RELEASE     // order cancelled / failed: reserved -= qty
  SALE        // payment/COD confirmed:   available -= qty, reserved -= qty
  PURCHASE    // admin restock:           available += qty
  ADJUSTMENT  // admin manual correction: available +/-
  DAMAGE      // admin write-off:         available -= qty
}
```

## 2. New models

```prisma
model Inventory {
  id                String   @id @default(uuid()) @db.Uuid
  productId         String   @unique @map("product_id") @db.Uuid
  quantityAvailable Int      @default(0) @map("quantity_available")
  quantityReserved  Int      @default(0) @map("quantity_reserved")
  minimumStockLevel Int      @default(0) @map("minimum_stock_level")
  lowStockNotified  Boolean  @default(false) @map("low_stock_notified")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  product   Product             @relation(fields: [productId], references: [id], onDelete: Cascade)
  movements InventoryMovement[]

  @@map("inventory")
}

model InventoryMovement {
  id             String       @id @default(uuid()) @db.Uuid
  inventoryId    String       @map("inventory_id") @db.Uuid
  type           MovementType
  quantityChange Int          @map("quantity_change") // signed; see reconciliation invariant §4
  note           String?
  orderId        String?      @map("order_id") @db.Uuid   // set for RESERVE/RELEASE/SALE
  userId         String?      @map("user_id")  @db.Uuid   // set for admin PURCHASE/ADJUSTMENT/DAMAGE
  createdAt      DateTime     @default(now()) @map("created_at")

  inventory Inventory @relation(fields: [inventoryId], references: [id], onDelete: Cascade)
  order     Order?    @relation(fields: [orderId], references: [id])

  @@index([inventoryId, createdAt])
  @@index([orderId])
  @@map("inventory_movements")
}

model OrderStatusHistory {
  id         String       @id @default(uuid()) @db.Uuid
  orderId    String       @map("order_id") @db.Uuid
  fromStatus OrderStatus? @map("from_status")
  toStatus   OrderStatus  @map("to_status")
  changedBy  String?      @map("changed_by_user_id") @db.Uuid
  note       String?
  createdAt  DateTime     @default(now()) @map("created_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
  @@map("order_status_history")
}

model PaymentWebhookEvent {
  id              String   @id @default(uuid()) @db.Uuid
  gateway         String                                   // "payhere" | "stripe"
  transactionId   String?  @map("transaction_id")
  eventStatus     String   @map("event_status")
  payload         Json
  signature       String?
  signatureValid  Boolean  @default(false) @map("signature_valid")
  processed       Boolean  @default(false)
  processingError String?  @map("processing_error")
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([gateway, transactionId, eventStatus])  // D5: idempotent — replays no-op
  @@map("payment_webhook_events")
}
```

Back-relations added to existing models (additive, non-breaking):
```prisma
// Product
inventory Inventory?
// Order
statusHistory      OrderStatusHistory[]
inventoryMovements InventoryMovement[]
```

## 3. Raw-SQL guard in the migration (defense in depth for BR4)

```sql
ALTER TABLE inventory ADD CONSTRAINT inventory_non_negative
  CHECK (quantity_available >= 0
     AND quantity_reserved  >= 0
     AND quantity_reserved  <= quantity_available);
```
Even if application logic has a bug, the DB itself refuses to let stock go negative or
over-reserve. This is the hard floor the current `products.stock_quantity` has never had.

## 4. Reconciliation invariant (the ledger must always balance)

For every inventory row, at all times:
```
quantity_available = SUM(quantityChange) over movements of type INITIAL, SALE, PURCHASE, ADJUSTMENT, DAMAGE
quantity_reserved  = SUM(quantityChange) over movements of type RESERVE, RELEASE, SALE
```
`SALE` appears in both because it simultaneously removes a unit from *reserved* and from
*available*. A nightly `reconcile-inventory` script (plan Session 5.1) asserts this and
prints any drift. Sign convention: RESERVE = +qty to reserved; RELEASE and SALE = −qty to
reserved; SALE = −qty to available; PURCHASE/positive-ADJUSTMENT = +qty to available.

## 5. Lifecycle rewire (follow-up session, NOT this delta)

The tables above are inert until the services write to them. That rewire replaces the
Bucket 1 `products.stock_quantity` stopgap:

| Trigger | Today (products.stock_quantity) | After rewire (inventory ledger) |
|---|---|---|
| Order placed | atomic decrement of stock | `SELECT … FOR UPDATE` inventory; reject if `available − reserved < qty`; `reserved += qty`; **RESERVE** movement; history `null→PENDING` |
| Payment / COD confirmed | (no stock change) | `available −= qty; reserved −= qty`; **SALE** movement; order `PENDING→CONFIRMED` + history |
| Order cancelled | increment stock back | `reserved −= qty`; **RELEASE** movement; order `→CANCELLED` + history |

This is the real fix for D3: unpaid PENDING orders hold a *reservation*, not a deduction.

## 6. Explicitly OUT of this delta (sequenced separately, to keep each change safe)

- **OrderStatus / PaymentStatus enum realignment** to the plan's canonical machines
  (IN_PRODUCTION/QUALITY_CHECK/COMPLETED; PROCESSING/PAID). These ripple through the
  services and belong with the payments realign (Step 3), not here.
- **Dropping `products.stock_quantity`** — only after the rewire (§5) is merged and nothing
  reads it. Big-bang drop now would break checkout.
- Production/AI/dashboard tables — built at their phases.

## 7. Rollout steps (once approved and Postgres is up)

1. Add §1–§2 to `apps/api` `schema.prisma`; add §3 as raw SQL in the migration.
2. **Adopt `prisma migrate`** (currently the project uses `db push`, no migration history):
   `prisma migrate dev --name add-inventory-ledger` (baseline the existing schema first).
3. `prisma generate`; export `MovementType` from the shared types location.
4. **Backfill script**: for each Product create an Inventory row with
   `quantity_available = products.stock_quantity`, `reserved = 0`, plus an **INITIAL**
   movement of `+stock_quantity` so the ledger balances from day one.
5. Rewire services (§5) behind the tests already in place, add the race + reconciliation
   tests (plan Sessions 3.2 / 5.1), then a later migration drops `products.stock_quantity`.

## 8. Decisions I made as lead (flag if you disagree)

- **Int quantities**, matching current `stock_quantity` / `OrderItem.quantity`. The plan uses
  DECIMAL because fabric sells by length — if you want to sell by the metre, switch these to
  `Decimal(10,2)` now (cheaper than later). Defaulting to Int for MVP simplicity.
- **Single signed `quantityChange` + type** (plan-aligned) over a two-column
  available/reserved delta. Simpler, and §3 + §4 keep it honest.
- **Switch to `prisma migrate`** from `db push` — a realign of this size needs migration
  history and repeatable rollout.
