import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, MovementType, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Inventory ledger operations (decisions D2/D3). The `inventory` table is the
 * single source of truth for stock; every mutation is a guarded, race-safe
 * UPDATE plus an append-only `inventory_movements` row, all inside the caller's
 * transaction.
 *
 * `products.stock_quantity` is kept as a denormalized cache of SELLABLE stock
 * (quantity_available - quantity_reserved) so the existing read path/frontend
 * keep working unchanged. It is updated in the same transaction as the ledger.
 * It will be dropped once product reads join `inventory` directly.
 *
 * Sign convention for quantity_change: RESERVE=+qty, RELEASE=-qty, SALE=-qty,
 * PURCHASE/positive-ADJUSTMENT=+qty. SALE decrements BOTH available and reserved.
 *
 * ─── Two kinds of method live here, and the difference matters ───────────────
 *
 * The ORDER paths (reserve/sale/release/restock) take the caller's `tx`. They are
 * steps inside someone else's transaction — checkout must reserve stock and write
 * the order atomically, so they must not open one of their own.
 *
 * The ADMIN paths (adjust/setMinimum/list/movements) own their transaction and use
 * `this.prisma`. Nobody else is mid-flight when an admin corrects a stock count.
 *
 * Mixing the two up is how you get a nested transaction that silently commits
 * half of a checkout, so the split is deliberate and enforced by the signatures.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Order placed: reserve stock. Guarded UPDATE prevents overselling under races. */
  async reserve(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
    productName?: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_reserved = quantity_reserved + ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_available - quantity_reserved >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Insufficient stock for "${productName ?? productId}"`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.RESERVE,
        quantityChange: quantity,
        orderId,
      },
    });

    // Sellable cache decreases by the reserved amount.
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: quantity } },
    });
  }

  /** Payment/COD confirmed: convert reservation into a sale. */
  async sale(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_available = quantity_available - ${quantity}::int,
             quantity_reserved  = quantity_reserved  - ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_reserved  >= ${quantity}::int
         AND quantity_available >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Cannot complete sale for product ${productId}: reservation missing`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.SALE,
        quantityChange: -quantity,
        orderId,
      },
    });
    // Sellable cache (available - reserved) is unchanged by a sale.

    // A sale is the commonest way stock falls through the floor (FR-018).
    await this.checkLowStock(tx, rows[0].id);
  }

  /** Cancellation/failure of a not-yet-sold order: release the reservation. */
  async release(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_reserved = quantity_reserved - ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
         AND quantity_reserved >= ${quantity}::int
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(
        `Cannot release reservation for product ${productId}`,
      );
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.RELEASE,
        quantityChange: -quantity,
        orderId,
      },
    });

    // Sellable cache increases as the reservation is freed.
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });
  }

  /** Cancellation of an already-sold order: return stock to available. */
  async restock(
    tx: Tx,
    productId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory
         SET quantity_available = quantity_available + ${quantity}::int,
             updated_at = now()
       WHERE product_id = ${productId}::uuid
      RETURNING id`;

    if (rows.length !== 1) {
      throw new BadRequestException(`Cannot restock product ${productId}`);
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: rows[0].id,
        type: MovementType.ADJUSTMENT,
        quantityChange: quantity,
        orderId,
        note: 'Restock from cancelled order',
      },
    });

    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });

    // Stock came back. If that lifts the product over its minimum, re-arm the
    // alert so a future dip is reported (FR-018).
    await this.checkLowStock(tx, rows[0].id);
  }

  // ═══ FR-018: low-stock alert (plan Session 5.1, task 2) ═══════════════════

  /**
   * Fires ONE notification when stock crosses the minimum, and not again until it
   * recovers.
   *
   * The `low_stock_notified` flag is the whole point. Without it, every sale of an
   * already-low product would file another alert, and an owner who opens their
   * bell to forty copies of "Leather Belt is low" simply stops reading it. An
   * alert that cries wolf is worse than no alert, because it trains the one person
   * who could act to ignore the one time it matters.
   *
   * Called from every DECREMENTING path — sale() and adjust() — inside the
   * caller's transaction, so the alert and the movement that caused it commit
   * together or not at all.
   */
  private async checkLowStock(tx: Tx, inventoryId: string): Promise<void> {
    const inventory = await tx.inventory.findUnique({
      where: { id: inventoryId },
      include: { product: { select: { name: true } } },
    });
    if (!inventory) return;

    const isLow = inventory.quantityAvailable <= inventory.minimumStockLevel;

    // Recovered: re-arm the alert so the NEXT dip is reported.
    if (!isLow && inventory.lowStockNotified) {
      await tx.inventory.update({
        where: { id: inventoryId },
        data: { lowStockNotified: false },
      });
      return;
    }

    // Still low, already told them. Say nothing.
    if (!isLow || inventory.lowStockNotified) return;

    // Crossed the line for the first time. Tell every admin, once.
    const admins = await tx.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'inventory.low_stock',
          title: `Low stock: ${inventory.product.name}`,
          body:
            `${inventory.quantityAvailable} left (minimum ${inventory.minimumStockLevel}). ` +
            `Reorder to avoid running out.`,
        })),
      });
    }

    await tx.inventory.update({
      where: { id: inventoryId },
      data: { lowStockNotified: true },
    });
  }

  // ═══ Admin operations (plan Session 5.1, task 1) ═══════════════════════════

  /** Types an ADMIN may use. RESERVE/RELEASE/SALE/INITIAL belong to the system. */
  static readonly ADJUSTABLE: MovementType[] = [
    MovementType.PURCHASE,
    MovementType.ADJUSTMENT,
    MovementType.DAMAGE,
  ];

  /**
   * An admin moves stock by hand: a delivery arrived (PURCHASE), a count was
   * wrong (ADJUSTMENT), a bolt of cloth was ruined (DAMAGE).
   *
   * BR4 IS ENFORCED BY THE UPDATE ITSELF, not by a read-then-write. The guarded
   * WHERE clause means a concurrent checkout cannot slip between our check and our
   * write — the same technique reserve() uses, and the reason the race tests pass.
   *
   * Two floors, and the second is the one people forget:
   *   available + change >= 0          — stock cannot go negative
   *   available + change >= reserved   — you cannot write off cloth that a
   *                                      customer has already paid to reserve
   *
   * The inventory_non_negative CHECK constraint backs both up at the database
   * level, so even a future bug here cannot corrupt the ledger.
   */
  async adjust(
    productId: string,
    change: number,
    type: MovementType,
    adminId: string,
    note?: string,
  ) {
    if (!InventoryService.ADJUSTABLE.includes(type)) {
      throw new BadRequestException(
        `${type} is a system movement. Admins may only record PURCHASE, ADJUSTMENT or DAMAGE.`,
      );
    }
    if (change === 0) {
      throw new BadRequestException('An adjustment of zero changes nothing.');
    }
    // DAMAGE removes stock and PURCHASE adds it — the sign is implied by the type,
    // so a "DAMAGE +50" would be a data-entry error, not a valid instruction.
    if (type === MovementType.PURCHASE && change < 0) {
      throw new BadRequestException('A purchase must increase stock.');
    }
    if (type === MovementType.DAMAGE && change > 0) {
      throw new BadRequestException('Damage must decrease stock.');
    }

    return this.prisma.$transaction(async (tx) => {
      /**
       * SELECT ... FOR UPDATE. The lock is not about the write — it is about the
       * TRUTH OF THE RECORD.
       *
       * The guarded UPDATE below is already race-safe on its own: its WHERE clause
       * is re-evaluated against the live row, so it cannot oversell no matter what
       * commits underneath it. The first version of this method relied on exactly
       * that and read the "before" state with an ordinary unlocked SELECT.
       *
       * That was wrong, and subtly. Prisma runs at READ COMMITTED, so between an
       * unlocked read and the UPDATE, a customer's checkout can commit a RESERVE.
       * The write would still be correct — but `before.quantityReserved` would be
       * stale, and it is written straight into the audit log. The audit log would
       * then record a prior state that never existed, and the error message would
       * quote a reserved figure that was already out of date when it was printed.
       *
       * An inventory ledger whose audit trail is only true when nobody else is
       * shopping is not an audit trail. So: take the row lock first, and everything
       * below reads a state that cannot move under us.
       */
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          available: number;
          reserved: number;
          name: string;
        }>
      >`
        SELECT i.id,
               i.quantity_available AS available,
               i.quantity_reserved  AS reserved,
               p.name
          FROM inventory i
          JOIN products p ON p.id = i.product_id
         WHERE i.product_id = ${productId}::uuid
         FOR UPDATE OF i`;

      if (locked.length !== 1) {
        throw new NotFoundException('This product has no inventory record.');
      }
      const before = locked[0];

      const rows = await tx.$queryRaw<Array<{ id: string; available: number }>>`
        UPDATE inventory
           SET quantity_available = quantity_available + ${change}::int,
               updated_at = now()
         WHERE product_id = ${productId}::uuid
           AND quantity_available + ${change}::int >= 0
           AND quantity_available + ${change}::int >= quantity_reserved
        RETURNING id, quantity_available AS available`;

      // Deliberately NOT pre-checked in TypeScript. The guarded UPDATE above is the
      // ONE place BR4 is enforced at the application layer; adding a second check
      // here would mean deleting the SQL guard no longer changes any observable
      // behaviour, and the mutation test that pins it would silently stop testing
      // anything. One guard, one test, one thing that can break.
      if (rows.length !== 1) {
        // We hold the lock, so these figures are exact rather than merely recent.
        const wouldBe = before.available + change;
        throw new BadRequestException(
          wouldBe < 0
            ? `That would leave ${wouldBe} in stock. Stock cannot go below zero (BR4).`
            : `That would leave ${wouldBe} available, but ${before.reserved} ` +
                `are reserved for orders already placed. Cancel those orders first.`,
        );
      }

      await tx.inventoryMovement.create({
        data: {
          inventoryId: rows[0].id,
          type,
          quantityChange: change,
          userId: adminId, // every movement traces to an order OR an admin
          note: note?.trim() || null,
        },
      });

      // The sellable cache moves with available; reserved is untouched.
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: change } },
      });

      // Doc 09 §11.2: who changed inventory, and what it was before.
      //
      // Every figure here comes from the LOCKED read, so this records the state
      // that actually preceded the write — not one that merely preceded the read.
      // `reserved` is unchanged by an adjustment (only orders move it), and because
      // we hold the row lock, nobody moved it behind our back either.
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'inventory.adjust',
          entityType: 'inventory',
          entityId: rows[0].id,
          before: {
            available: before.available,
            reserved: before.reserved,
          },
          after: {
            available: rows[0].available,
            reserved: before.reserved,
            type,
            change,
            note: note ?? null,
          },
        },
      });

      // Called for BOTH directions, deliberately. A PURCHASE that lifts stock back
      // over the minimum must RE-ARM the alert (checkLowStock clears the flag when
      // it sees stock has recovered). Guarding this with `if (change < 0)` looks
      // like an optimisation and is actually a bug: the flag would stay stuck at
      // true forever, and the next time the product ran low, nobody would be told.
      await this.checkLowStock(tx, rows[0].id);

      return this.findOne(productId, tx);
    });
  }

  /** Admins may raise or lower the reorder threshold. */
  async setMinimum(productId: string, minimum: number, adminId: string) {
    if (minimum < 0) {
      throw new BadRequestException('The minimum level cannot be negative.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Locked for the same reason as adjust(): the audit log below claims what the
      // threshold WAS, and a claim read outside a lock is a guess.
      const locked = await tx.$queryRaw<Array<{ id: string; minimum: number }>>`
        SELECT id, minimum_stock_level AS minimum
          FROM inventory
         WHERE product_id = ${productId}::uuid
         FOR UPDATE`;

      if (locked.length !== 1) {
        throw new NotFoundException('This product has no inventory record.');
      }
      const inventory = locked[0];

      await tx.inventory.update({
        where: { productId },
        data: {
          minimumStockLevel: minimum,
          // Raising the threshold can put a product below it. Re-arm so the check
          // below can fire; otherwise a product could sit under a NEW minimum and
          // never be reported.
          lowStockNotified: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'inventory.set_minimum',
          entityType: 'inventory',
          entityId: inventory.id,
          before: { minimumStockLevel: inventory.minimum },
          after: { minimumStockLevel: minimum },
        },
      });

      await this.checkLowStock(tx, inventory.id);

      return this.findOne(productId, tx);
    });
  }

  // ═══ Reads ════════════════════════════════════════════════════════════════

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.InventoryWhereInput = {
      product: {
        isActive: true,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    // "Low" is available <= minimum, which Prisma cannot express as a
    // column-to-column comparison in a where clause, so it is applied here.
    // The page is at most 100 rows, so the cost is nil — and pushing it into raw
    // SQL would cost the type safety of the include above.
    const shaped = rows.map((row) => this.shape(row));
    const items = query.lowStockOnly
      ? shaped.filter((item) => item.status !== 'OK')
      : shaped;

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Everything at or below its minimum. Drives the sidebar badge and the alert chip. */
  async lowStock() {
    const rows = await this.prisma.$queryRaw<Array<{ product_id: string }>>`
      SELECT i.product_id
        FROM inventory i
        JOIN products p ON p.id = i.product_id
       WHERE p.is_active
         AND i.quantity_available <= i.minimum_stock_level
       ORDER BY (i.quantity_available - i.minimum_stock_level) ASC`;

    const items = await this.prisma.inventory.findMany({
      where: { productId: { in: rows.map((r) => r.product_id) } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    return {
      count: items.length,
      items: items.map((item) => this.shape(item)),
    };
  }

  /**
   * The ledger for one product.
   *
   * Every row carries WHO or WHAT caused it — an order number, or an admin's name.
   * "Stock went down by 5" is not an audit trail; "SALE −5, order TXL-…, 3pm" is.
   */
  async movements(productId: string, page = 1, limit = 25) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inventory) {
      throw new NotFoundException('This product has no inventory record.');
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { inventoryId: inventory.id },
        include: {
          order: { select: { orderNumber: true } },
          // userId has no relation on this model (it is a plain column), so the
          // admin's name is resolved below rather than joined.
        },
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(1, page) - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({
        where: { inventoryId: inventory.id },
      }),
    ]);

    const adminIds = [
      ...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)),
    ];
    const admins = adminIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameOf = new Map(
      admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        quantityChange: row.quantityChange,
        note: row.note,
        createdAt: row.createdAt,
        // Exactly one of these is set. A movement with neither is a bug.
        orderNumber: row.order?.orderNumber ?? null,
        adminName: row.userId
          ? (nameOf.get(row.userId) ?? 'Unknown admin')
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(productId: string, client: Tx | PrismaService = this.prisma) {
    const row = await client.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: { select: { name: true } },
          },
        },
      },
    });
    if (!row)
      throw new NotFoundException('This product has no inventory record.');
    return this.shape(row);
  }

  private shape(row: {
    id: string;
    quantityAvailable: number;
    quantityReserved: number;
    minimumStockLevel: number;
    updatedAt: Date;
    product: {
      id: string;
      name: string;
      sku: string;
      category: { name: string } | null;
    };
  }) {
    const sellable = row.quantityAvailable - row.quantityReserved;

    return {
      productId: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      category: row.product.category?.name ?? null,
      available: row.quantityAvailable,
      reserved: row.quantityReserved,
      /** What a customer can actually buy right now. */
      sellable,
      minimum: row.minimumStockLevel,
      /**
       * OUT is not "low but worse" — it is a different problem. A LOW product still
       * sells while you reorder; an OUT one is turning customers away right now.
       */
      status:
        row.quantityAvailable === 0
          ? ('OUT' as const)
          : row.quantityAvailable <= row.minimumStockLevel
            ? ('LOW' as const)
            : ('OK' as const),
      updatedAt: row.updatedAt,
    };
  }
}
