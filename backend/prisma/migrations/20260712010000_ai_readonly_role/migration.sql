-- A read-only database role for the AI service (decision D9, doc 09 §8).
--
-- The AI service NEVER gets write credentials. This is structural, not a
-- promise: even if the LLM were talked into emitting a DELETE — and it cannot,
-- because it never emits SQL at all (D9 replaces doc 08's text-to-SQL design) —
-- Postgres itself would refuse. Defence in depth, the same principle as the BR4
-- CHECK constraint on inventory.
--
-- The role can read only what a shopping assistant legitimately needs: the
-- catalog and its stock. It cannot see users, orders, payments or measurements.
-- The BUSINESS assistant reaches analytics through the NestJS API's whitelisted
-- tool layer, not by querying these tables directly.
--
-- Password is a local-development default. Production overrides it via
-- AI_DB_PASSWORD before this runs (see docs/RUNBOOK).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'textile_ai_readonly') THEN
    CREATE ROLE textile_ai_readonly LOGIN PASSWORD 'ai_readonly_local_dev_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE textile_db TO textile_ai_readonly;
GRANT USAGE ON SCHEMA public TO textile_ai_readonly;

-- Explicit allow-list. NOT "GRANT SELECT ON ALL TABLES" — that would silently
-- hand the AI every future table, including any that holds personal data.
GRANT SELECT ON TABLE "products"   TO textile_ai_readonly;
GRANT SELECT ON TABLE "categories" TO textile_ai_readonly;
GRANT SELECT ON TABLE "inventory"  TO textile_ai_readonly;

-- Make the absence of write permission explicit and testable.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM textile_ai_readonly;
