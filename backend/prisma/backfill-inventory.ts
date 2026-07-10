/**
 * One-time backfill: seed the inventory ledger (D2/D3) from the legacy
 * products.stock_quantity. Idempotent — safe to re-run; existing inventory
 * rows are skipped. Also reconciles the ledger and exits non-zero on drift.
 *
 * Run: npx ts-node prisma/backfill-inventory.ts
 */
import { PrismaClient, MovementType } from '@prisma/client';

const prisma = new PrismaClient();

// Which movement types affect each pool (single signed quantityChange per row).
// SALE affects BOTH pools: it removes a unit from reserved AND from available.
const AFFECTS_AVAILABLE = new Set<MovementType>([
  MovementType.INITIAL,
  MovementType.SALE,
  MovementType.PURCHASE,
  MovementType.ADJUSTMENT,
  MovementType.DAMAGE,
]);
const AFFECTS_RESERVED = new Set<MovementType>([
  MovementType.RESERVE,
  MovementType.RELEASE,
  MovementType.SALE,
]);

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, stockQuantity: true },
  });

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { productId: product.id },
      });
      if (existing) {
        skipped++;
        return;
      }

      const inventory = await tx.inventory.create({
        data: {
          productId: product.id,
          quantityAvailable: product.stockQuantity,
          quantityReserved: 0,
          minimumStockLevel: 0,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: MovementType.INITIAL,
          quantityChange: product.stockQuantity,
          note: 'Backfill: opening balance from products.stock_quantity',
        },
      });
      created++;
    });
  }

  // Reconciliation invariant: the ledger must equal the counters.
  const inventories = await prisma.inventory.findMany({ include: { movements: true } });
  let drift = 0;
  for (const inv of inventories) {
    const avail = inv.movements
      .filter((m) => AFFECTS_AVAILABLE.has(m.type))
      .reduce((s, m) => s + m.quantityChange, 0);
    const reserved = inv.movements
      .filter((m) => AFFECTS_RESERVED.has(m.type))
      .reduce((s, m) => s + m.quantityChange, 0);
    if (avail !== inv.quantityAvailable || reserved !== inv.quantityReserved) {
      drift++;
      console.log(
        `DRIFT ${inv.productId}: ledger avail=${avail} vs ${inv.quantityAvailable}, reserved=${reserved} vs ${inv.quantityReserved}`,
      );
    }
  }

  console.log(
    `\nBackfill complete → created=${created}, skipped=${skipped}, inventories=${inventories.length}, drift=${drift}`,
  );
  if (drift > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
