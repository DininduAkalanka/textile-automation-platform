-- ─── The ledger must outlive nothing; nothing may outlive the ledger ────────
--
-- inventory_movements.order_id was created with Prisma's default action for an
-- optional relation: ON DELETE SET NULL. That meant deleting an order quietly
-- erased the reason for every stock movement it had caused. The stock had still
-- moved. The ledger just could no longer say why, and no error was ever raised.
--
-- The reconciliation script (npm run reconcile) found real orphans of exactly
-- this kind on its first run. RESTRICT makes it structurally impossible: an order
-- that has moved stock cannot be deleted. Orders are financial records — they get
-- cancelled, not erased.
--
-- Existing orphans (order_id already NULL) are left in place. They are historical
-- damage, and inventing an order number for them would be worse than admitting the
-- trail was lost.

ALTER TABLE "inventory_movements"
  DROP CONSTRAINT "inventory_movements_order_id_fkey";

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
