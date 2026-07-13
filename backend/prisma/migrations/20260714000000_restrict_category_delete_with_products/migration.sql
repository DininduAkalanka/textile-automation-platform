-- ─── A category with products cannot be deleted out from under them ────────
--
-- products.category_id was created with Prisma's default action for an
-- optional relation: ON DELETE SET NULL. That meant deleting a category
-- silently orphaned every product in it (category_id -> null) instead of the
-- 409 the plan requires: "prevent deleting a category that has products or
-- children (409 with clear message)."
--
-- The category-has-CHILDREN case was already safe — parent_category_id's FK
-- is ON DELETE RESTRICT (see schema.prisma's CategoryTree relation). Only the
-- category-has-PRODUCTS case was open. Same bug class as the
-- 20260712100000 migration (inventory_movements.order_id), found the same
-- way: by reading the FK Postgres actually has, not the one the schema
-- implied it should.

ALTER TABLE "products"
  DROP CONSTRAINT "products_category_id_fkey";

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
