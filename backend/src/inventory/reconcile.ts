import { PrismaClient } from '@prisma/client';

/**
 * The inventory reconciliation check (plan Session 5.1, task 4).
 *
 * ═══ THE INVARIANT ══════════════════════════════════════════════════════════
 *
 * `inventory_movements` is an append-only ledger. `inventory` holds the running
 * totals. If the two disagree, the totals are WRONG — the ledger is the history,
 * and history does not change.
 *
 * The plan states the invariant as:
 *
 *     SUM(movements) == quantity_available + quantity_reserved
 *
 * That is not right, and the difference is not pedantic. A SALE decrements
 * available AND reserved, but it appears in the ledger as ONE row. A single sum
 * over every row therefore counts the sale once while the balances moved twice,
 * and the check drifts by the value of every sale ever made. The plan itself says
 * "define the exact invariant in code comments" — this is that definition:
 *
 *     quantity_available = Σ(change) WHERE type ∈ (INITIAL, PURCHASE,
 *                                                  ADJUSTMENT, DAMAGE, SALE)
 *     quantity_reserved  = Σ(change) WHERE type ∈ (RESERVE, RELEASE, SALE)
 *
 * SALE is in BOTH sets. That is the whole subtlety, and it is why one sum cannot
 * work. Signs are carried by the rows themselves (RELEASE, SALE and DAMAGE are
 * stored negative), so both sides are plain sums with no case analysis.
 *
 * Two derived invariants follow, and are checked too:
 *
 *     quantity_available >= quantity_reserved         (sellable never negative —
 *                                                      you cannot promise cloth you
 *                                                      do not have)
 *     products.stock_quantity = available - reserved  (the denormalised cache)
 *
 * ─── Why this lives in src/ and not in the script ───────────────────────────
 *
 * Because the integration test imports it. If the test re-implemented the formula,
 * the two copies would drift, and the test would end up proving that a COPY of the
 * reconciler passes — while the reconciler CI actually runs could be broken. One
 * definition, two callers.
 */

/** Enough of a PrismaClient to run the checks; satisfied by PrismaService too. */
type Db = Pick<PrismaClient, '$queryRaw' | 'product' | 'inventory'>;

export interface Drift {
  sku: string;
  name: string;
  problem: string;
  expected: number | string;
  actual: number | string;
}

interface BalanceRow {
  product_id: string;
  sku: string;
  name: string;
  available: number;
  reserved: number;
  stock_available: number;
  stock_reserved: number;
  cache: number;
}

/**
 * `skuPrefix` scopes the check. The CLI passes nothing and audits the whole
 * database; the integration test passes its own tag so a pre-existing scar
 * elsewhere in a developer's database cannot fail an unrelated assertion.
 */
export async function findDrift(db: Db, skuPrefix?: string): Promise<Drift[]> {
  const drifts: Drift[] = [];
  const like = skuPrefix ? `${skuPrefix}%` : '%';

  const balances = await db.$queryRaw<BalanceRow[]>`
    SELECT p.id   AS product_id,
           p.sku,
           p.name,
           -- Rebuilt from history.
           COALESCE(SUM(m.quantity_change) FILTER (
             WHERE m.type IN ('INITIAL', 'PURCHASE', 'ADJUSTMENT', 'DAMAGE', 'SALE')
           ), 0)::int AS available,
           COALESCE(SUM(m.quantity_change) FILTER (
             WHERE m.type IN ('RESERVE', 'RELEASE', 'SALE')
           ), 0)::int AS reserved,
           -- What the totals actually say.
           i.quantity_available::int AS stock_available,
           i.quantity_reserved::int  AS stock_reserved,
           p.stock_quantity::int     AS cache
      FROM inventory i
      JOIN products p                 ON p.id = i.product_id
      LEFT JOIN inventory_movements m ON m.inventory_id = i.id
     WHERE p.sku LIKE ${like}
     GROUP BY p.id, p.sku, p.name, i.quantity_available, i.quantity_reserved,
              p.stock_quantity
     ORDER BY p.name`;

  for (const row of balances) {
    if (row.available !== row.stock_available) {
      drifts.push({
        sku: row.sku,
        name: row.name,
        problem: 'quantity_available disagrees with the ledger',
        expected: row.available,
        actual: row.stock_available,
      });
    }
    if (row.reserved !== row.stock_reserved) {
      drifts.push({
        sku: row.sku,
        name: row.name,
        problem: 'quantity_reserved disagrees with the ledger',
        expected: row.reserved,
        actual: row.stock_reserved,
      });
    }
    if (row.stock_available < row.stock_reserved) {
      drifts.push({
        sku: row.sku,
        name: row.name,
        problem: 'OVER-RESERVED: more stock is promised than exists (BR4)',
        expected: `reserved <= ${row.stock_available}`,
        actual: `reserved = ${row.stock_reserved}`,
      });
    }
    const sellable = row.stock_available - row.stock_reserved;
    if (row.cache !== sellable) {
      drifts.push({
        sku: row.sku,
        name: row.name,
        problem: 'products.stock_quantity cache is stale',
        expected: sellable,
        actual: row.cache,
      });
    }
  }

  /**
   * A product with no inventory row cannot be sold and cannot be counted — it is
   * invisible to every guard in the system. This was a real bug (fixed in
   * c930e05); the check stays so it cannot come back unnoticed.
   */
  const noLedger = await db.$queryRaw<Array<{ sku: string; name: string }>>`
    SELECT p.sku, p.name
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
     WHERE i.id IS NULL
       AND p.sku LIKE ${like}`;

  for (const row of noLedger) {
    drifts.push({
      sku: row.sku,
      name: row.name,
      problem: 'product has NO inventory row — it can never be sold or counted',
      expected: '1 inventory row',
      actual: 'none',
    });
  }

  /**
   * Plan acceptance criterion: "every movement in the UI traces to an order or an
   * admin". A movement with neither is stock that moved for no recorded reason.
   *
   * INITIAL is exempt: it is the opening balance written when the product itself
   * is created, and "why" is answered by the type.
   */
  const untraceable = await db.$queryRaw<
    Array<{ sku: string; name: string; type: string; count: number }>
  >`
    SELECT p.sku, p.name, m.type::text, COUNT(*)::int AS count
      FROM inventory_movements m
      JOIN inventory i ON i.id = m.inventory_id
      JOIN products  p ON p.id = i.product_id
     WHERE m.order_id IS NULL
       AND m.user_id  IS NULL
       AND m.type <> 'INITIAL'
       AND p.sku LIKE ${like}
     GROUP BY p.sku, p.name, m.type`;

  for (const row of untraceable) {
    drifts.push({
      sku: row.sku,
      name: row.name,
      problem: `${row.count} ${row.type} movement(s) trace to neither an order nor an admin`,
      expected: 'order_id or user_id',
      actual: 'both null',
    });
  }

  return drifts;
}

/**
 * The offending movement window: the ledger rows around a drifting product, with
 * the balances REBUILT step by step as they replay.
 *
 * Printing "expected 57, got 60" tells you a product is wrong. It does not tell you
 * WHICH write went missing, and that is the only question worth asking. Replaying
 * the ledger with a running balance beside each row turns the answer into something
 * you can see: the running total tracks the real one until, at one specific row, it
 * stops. That row — or the write that should have been next to it — is the bug.
 *
 * The running balances are computed in SQL as window functions rather than in
 * TypeScript, so the arithmetic is the DATABASE's, exactly like the sums the drift
 * check itself uses. A discrepancy caused by our own rounding would be a maddening
 * thing to chase.
 */
export async function movementWindow(db: Db, sku: string, limit = 15) {
  return db.$queryRaw<
    Array<{
      type: string;
      change: number;
      running_available: number;
      running_reserved: number;
      trace: string | null;
      note: string | null;
      created_at: Date;
    }>
  >`
    WITH replayed AS (
      SELECT m.type::text,
             m.quantity_change AS change,
             -- COALESCE, because a windowed SUM ... FILTER over no matching rows yet
             -- returns NULL, not 0 — and a column of NULLs where the balance has not
             -- moved yet reads like missing data rather than "nothing has happened".
             COALESCE(SUM(m.quantity_change) FILTER (
               WHERE m.type IN ('INITIAL','PURCHASE','ADJUSTMENT','DAMAGE','SALE')
             ) OVER (ORDER BY m.created_at, m.id), 0)::int AS running_available,
             COALESCE(SUM(m.quantity_change) FILTER (
               WHERE m.type IN ('RESERVE','RELEASE','SALE')
             ) OVER (ORDER BY m.created_at, m.id), 0)::int AS running_reserved,
             -- INITIAL is the opening balance: it has no order and no admin by
             -- design, and findDrift() exempts it for exactly that reason. Flagging
             -- it here as untraceable would cry wolf on every single product.
             CASE
               WHEN m.type = 'INITIAL' THEN 'opening balance'
               ELSE COALESCE(o.order_number, u.email)
             END AS trace,
             m.note,
             m.created_at
        FROM inventory_movements m
        JOIN inventory i    ON i.id = m.inventory_id
        JOIN products  p    ON p.id = i.product_id
        LEFT JOIN orders o  ON o.id = m.order_id
        LEFT JOIN users  u  ON u.id = m.user_id
       WHERE p.sku = ${sku}
    )
    SELECT * FROM replayed
     ORDER BY created_at DESC
     LIMIT ${limit}`;
}

/**
 * Rebuilds `products.stock_quantity` from the source of truth.
 *
 * This is the ONLY thing that may be auto-repaired. That column is a denormalised
 * cache of `available - reserved`, so recomputing it loses nothing.
 *
 * `inventory.quantity_available` / `quantity_reserved` are deliberately NOT
 * repairable. They ARE the source of truth. If they disagree with the ledger, a
 * stock mutation escaped its transaction, and silently overwriting the totals
 * would destroy the only evidence of the bug while making the symptom disappear.
 * That is not a repair; it is a cover-up.
 */
export async function repairCache(
  db: Db,
  skuPrefix?: string,
): Promise<string[]> {
  const like = skuPrefix ? `${skuPrefix}%` : '%';

  const stale = await db.$queryRaw<
    Array<{ product_id: string; sku: string; cache: number; sellable: number }>
  >`
    SELECT p.id AS product_id,
           p.sku,
           p.stock_quantity::int AS cache,
           (i.quantity_available - i.quantity_reserved)::int AS sellable
      FROM products p
      JOIN inventory i ON i.product_id = p.id
     WHERE p.sku LIKE ${like}
       AND p.stock_quantity <> i.quantity_available - i.quantity_reserved`;

  for (const row of stale) {
    await db.product.update({
      where: { id: row.product_id },
      data: { stockQuantity: row.sellable },
    });
  }

  return stale.map(
    (r) => `${r.sku}: stock_quantity ${r.cache} -> ${r.sellable}`,
  );
}
