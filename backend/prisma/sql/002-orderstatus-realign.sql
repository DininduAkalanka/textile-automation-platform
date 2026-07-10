-- ⚠ SUPERSEDED — DO NOT RUN. Retained as a historical record only.
--
-- This was a one-time remap for databases created before the OrderStatus
-- realign. It is now baked into prisma/migrations/0_init, which creates the
-- enum already in canonical form.
--
-- Re-running it against a current database is DESTRUCTIVE: it renames the live
-- "OrderStatus" type and then drops "OrderStatus_old". The "non-destructive"
-- claim below held only for the pre-realign schema it was written against.
--
-- ── Original note ──────────────────────────────────────────────────────────
-- Migration 002 — realign OrderStatus to the doc-canonical machine + add WORKER role.
-- (IMPLEMENTATION_PLAN_V2 DR-2 / DR-5.)
--
-- In-place and NON-destructive: existing rows are remapped, not wiped
-- (PROCESSING -> IN_PRODUCTION, SHIPPED -> COMPLETED). No tables or relationships
-- change — only two enum value sets. After this runs, the DB matches schema.prisma
-- exactly (zero drift). Apply once:
--   docker exec -i textile_postgresdocker psql -U textile_admin -d textile_db -f - < prisma/sql/002-orderstatus-realign.sql

-- 1) UserRole: additive. ADD VALUE autocommits; keep it outside the swap transaction.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WORKER';

-- 2) OrderStatus: Postgres can't drop enum values in place, so swap the type and
--    remap the three columns that use it.
BEGIN;

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'QUALITY_CHECK', 'COMPLETED', 'DELIVERED', 'CANCELLED'
);

ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN status TYPE "OrderStatus" USING (
  CASE status::text
    WHEN 'PROCESSING' THEN 'IN_PRODUCTION'
    WHEN 'SHIPPED'    THEN 'COMPLETED'
    ELSE status::text
  END::"OrderStatus"
);
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE order_status_history ALTER COLUMN from_status TYPE "OrderStatus" USING (
  CASE from_status::text
    WHEN 'PROCESSING' THEN 'IN_PRODUCTION'
    WHEN 'SHIPPED'    THEN 'COMPLETED'
    ELSE from_status::text
  END::"OrderStatus"
);
ALTER TABLE order_status_history ALTER COLUMN to_status TYPE "OrderStatus" USING (
  CASE to_status::text
    WHEN 'PROCESSING' THEN 'IN_PRODUCTION'
    WHEN 'SHIPPED'    THEN 'COMPLETED'
    ELSE to_status::text
  END::"OrderStatus"
);

DROP TYPE "OrderStatus_old";

COMMIT;
