/**
 * Inventory reconciliation — CLI (plan Session 5.1, task 4).
 *
 *   npm run reconcile              audit the whole database, exit 1 on any drift
 *   npm run reconcile -- --repair  additionally rebuild the derived stock cache
 *
 * The checks and the invariant they enforce live in src/inventory/reconcile.ts,
 * because the integration test imports the same function. A reconciler that CI
 * runs but no test exercises is a reconciler nobody has ever seen fail.
 *
 * ═══ WHY THIS EXISTS ════════════════════════════════════════════════════════
 *
 * Every stock mutation is already transactional and guarded, so in principle this
 * can never fail. That is exactly why it is worth running: the day it DOES fail,
 * an assumption we are all relying on has quietly stopped being true, and the
 * alternative to finding out here is finding out from a customer who was sold a
 * bolt of cloth that does not exist.
 *
 * It earned its keep immediately — the first run against the development database
 * found a stale cache left by an old seed, and five movement rows whose orders had
 * been deleted out from under them (fixed by the 20260712100000 migration).
 *
 * Exits non-zero on drift, so CI fails loudly rather than logging into a void.
 */
import { PrismaClient } from '@prisma/client';

import { findDrift, movementWindow, repairCache } from '../src/inventory/reconcile';

const prisma = new PrismaClient();
const REPAIR = process.argv.includes('--repair');

async function main() {
  if (REPAIR) {
    const repaired = await repairCache(prisma);
    if (repaired.length > 0) {
      console.log(`↻ rebuilt the derived cache for ${repaired.length} product(s):`);
      for (const line of repaired) console.log(`    ${line}`);
      console.log();
    }
  }

  const drifts = await findDrift(prisma);
  const checked = await prisma.inventory.count();

  if (drifts.length === 0) {
    console.log(`✓ inventory reconciled — ${checked} product(s), no drift.`);
    console.log(
      '  available = Σ(INITIAL,PURCHASE,ADJUSTMENT,DAMAGE,SALE)   ' +
        'reserved = Σ(RESERVE,RELEASE,SALE)',
    );
    return;
  }

  console.error(
    `✗ inventory DRIFT — ${drifts.length} problem(s) across ${checked} product(s):\n`,
  );
  console.table(drifts);

  // The offending movement window. "Expected 57, got 60" says a product is wrong;
  // it does not say WHICH write went missing, and that is the only question worth
  // asking. Replaying the ledger with a running balance shows where the two stopped
  // agreeing — read down the running columns until they diverge from the totals in
  // the table above, and the write that should have been there is the bug.
  for (const sku of [...new Set(drifts.map((d) => d.sku))]) {
    console.error(`\n── ${sku} · last movements, ledger replayed ──`);
    const window = await movementWindow(prisma, sku);

    if (window.length === 0) {
      console.error('   (no movements at all — the ledger was never opened)');
      continue;
    }

    console.table(
      window.map((m) => ({
        when: m.created_at.toISOString().slice(0, 16).replace('T', ' '),
        type: m.type,
        change: m.change,
        'running available': m.running_available,
        'running reserved': m.running_reserved,
        // The whole point of the audit trail: an order number, or a person.
        'order / admin': m.trace ?? '⚠ UNTRACEABLE',
        note: m.note ?? '',
      })),
    );
  }

  console.error(
    '\nThe ledger is the source of truth.\n' +
      '  · "cache is stale" is derived data — safe to rebuild: npm run reconcile -- --repair\n' +
      '  · anything else means a stock mutation escaped its transaction. Do NOT overwrite\n' +
      '    the totals to make it go away; find the write that got out.',
  );
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('reconcile-inventory failed to run:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
