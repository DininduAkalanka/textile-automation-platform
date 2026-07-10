-- ⚠ SUPERSEDED — do not run. Retained for historical reference.
--
-- The fold-in this file asked for has been done: the constraint now lives in
-- prisma/migrations/0_init/migration.sql, so every database (fresh or existing)
-- receives it from the migration history. Applying this by hand is a no-op.
--
-- ── Original note ──────────────────────────────────────────────────────────
-- BR4 hard floor for the inventory ledger (D2/D3).
-- Prisma cannot express CHECK constraints in schema.prisma, so this must be
-- applied after `prisma db push`. When we migrate to `prisma migrate`, fold
-- this into the migration SQL instead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_non_negative'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT inventory_non_negative
      CHECK (quantity_available >= 0
         AND quantity_reserved  >= 0
         AND quantity_reserved  <= quantity_available);
  END IF;
END $$;
