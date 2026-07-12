-- Analytics views for the business-intelligence assistant (Session 9.2, D9).
--
-- THE POINT OF THIS MIGRATION:
--
-- The business assistant must answer "what were my best sellers?" and "what
-- should I restock?". Those need orders, order_items and payments — tables that
-- also hold shipping addresses, customer names and order notes.
--
-- Granting the AI role SELECT on those tables would mean that anyone who
-- compromised the AI service, or talked the model into echoing a row, could read
-- a customer's home address. Doc 09 §8.2 says to remove sensitive fields before
-- anything reaches the LLM; a view removes them before they reach the SERVICE at
-- all.
--
-- So the AI role gets no access to the base tables — only to these views, which
-- simply do not contain the columns. It can compute revenue to the cent and
-- cannot learn who paid it. That is enforced by Postgres, not by our discipline.

-- ─── Sales facts: one row per order line ────────────────────────────────────
-- No user_id, no shipping_address, no billing_address, no notes.
CREATE OR REPLACE VIEW ai_sales_facts AS
SELECT o.id                                   AS order_id,
       o.order_number,
       o.status::text                         AS order_status,
       o.created_at                           AS ordered_at,
       pay.status::text                       AS payment_status,
       COALESCE(pay.paid_at, pay.created_at)  AS paid_at,
       oi.product_id,
       pr.name                                AS product_name,
       pr.product_type::text                  AS product_type,
       oi.quantity,
       oi.unit_price,
       oi.total_price                         AS line_revenue,
       -- Cost is nullable: a product whose cost was never entered must not
       -- silently report 100% margin, so profit tools skip these rows.
       pr.cost_price,
       (oi.quantity * pr.cost_price)          AS line_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products pr    ON pr.id = oi.product_id
  LEFT JOIN payments pay ON pay.order_id = o.id;

-- ─── Inventory facts: what to restock ───────────────────────────────────────
CREATE OR REPLACE VIEW ai_inventory_facts AS
SELECT p.id            AS product_id,
       p.name          AS product_name,
       p.product_type::text AS product_type,
       p.price,
       i.quantity_available,
       i.quantity_reserved,
       (i.quantity_available - i.quantity_reserved) AS sellable,
       i.minimum_stock_level,
       (i.quantity_available <= i.minimum_stock_level) AS is_low
  FROM products p
  JOIN inventory i ON i.product_id = p.id
 WHERE p.is_active;

-- The AI role may read the VIEWS. It is still forbidden the base tables, so a
-- query against `orders` fails even though the view over it succeeds.
GRANT SELECT ON ai_sales_facts     TO textile_ai_readonly;
GRANT SELECT ON ai_inventory_facts TO textile_ai_readonly;
