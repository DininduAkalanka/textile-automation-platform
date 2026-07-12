-- D10: Postgres full-text search over the catalog.
--
-- This powers the public product search NOW and the AI shopping assistant's
-- retriever in Phase 9 — the plan puts the index here deliberately so it is
-- "free later" (Session 2.1).
--
-- A GENERATED column, not a trigger and not application code: Postgres maintains
-- it on every insert and update, so the index can never drift out of step with
-- the product. There is no code path that can forget to reindex.
--
-- Weights encode what a shopper actually means. A search for "cotton" should
-- rank a product NAMED "Cotton Shirt" above one whose description merely
-- mentions cotton, and a fabric_type match matters more than a passing word in
-- prose:
--   A = name          (highest)
--   B = fabric_type, color
--   C = description   (lowest)

ALTER TABLE "products"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')),        'A') ||
    setweight(to_tsvector('english', coalesce("fabric_type", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("color", '')),       'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

-- GIN is the right index for tsvector: it is built for "which rows contain this
-- term", which is exactly what a search is.
CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");
