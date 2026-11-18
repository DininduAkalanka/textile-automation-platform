BEGIN;

ALTER TABLE users ADD COLUMN reset_token_hash TEXT, ADD COLUMN reset_expires_at TIMESTAMP(3);
CREATE UNIQUE INDEX users_reset_token_hash_key ON users(reset_token_hash);

ALTER TABLE notifications ADD COLUMN target_id UUID;

UPDATE notifications n
SET target_id = o.id
FROM orders o
WHERE n.type = 'order.status_changed' AND n.user_id = o.user_id
  AND split_part(n.title, ' ', 1) = 'Order'
  AND split_part(n.title, ' ', 2) = o.order_number;

-- Historical stock alerts recorded only the name. Link an exact, unique match.
WITH named_products AS (
  SELECT name, (array_agg(id))[1] AS id
  FROM products GROUP BY name HAVING count(*) = 1
)
UPDATE notifications n
SET target_id = p.id
FROM named_products p
WHERE n.type = 'inventory.low_stock' AND n.title = 'Low stock: ' || p.name;

COMMIT;
