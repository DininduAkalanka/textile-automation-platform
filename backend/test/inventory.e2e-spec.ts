import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { findDrift } from '../src/inventory/reconcile';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Admin stock control — plan Session 5.1, task 5 and its acceptance criteria.
 *
 * Real Postgres, real transactions. The guarded UPDATE that stops an admin from
 * writing off cloth a customer has already paid to reserve is a property of the
 * database's row locking, not of our TypeScript, and a mocked Prisma would assert
 * only that we call a function we wrote.
 *
 * ─── Why the rejections are asserted BY TYPE, not just by "it threw" ─────────
 *
 * Stock has TWO independent defences:
 *
 *   1. the guarded UPDATE in InventoryService.adjust() (application layer), and
 *   2. the `inventory_non_negative` CHECK constraint (database layer), which
 *      enforces `quantity_reserved <= quantity_available`.
 *
 * Delete (1) and the write STILL fails — layer 2 catches it, just with a raw
 * Postgres error instead of a clean 400. A test asserting only `.rejects.toThrow()`
 * would therefore pass with the application guard removed. That exact mistake was
 * made once already in stock-race.e2e-spec.ts. Asserting BadRequestException AND
 * the message pins the behaviour to layer 1 and leaves layer 2 as the backstop it
 * is meant to be.
 *
 *   npm run test:integration
 */

const TAG = `invtest-${Date.now()}`;

describe('Inventory admin operations (FR-018 / BR4 / plan 5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let inventory: InventoryService;
  let orders: OrdersService;
  let adminId: string;
  let customerId: string;

  const address = {
    fullName: 'Stock Tester',
    addressLine1: '1 Ledger Row',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00100',
    country: 'LK',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    inventory = app.get(InventoryService);
    orders = app.get(OrdersService);

    const admin = await prisma.user.create({
      data: {
        email: `${TAG}-admin@example.test`,
        passwordHash: 'not-a-real-hash',
        emailVerified: true,
        firstName: 'Ivy',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      },
    });
    adminId = admin.id;

    const customer = await prisma.user.create({
      data: {
        email: `${TAG}-customer@example.test`,
        passwordHash: 'not-a-real-hash',
        emailVerified: true,
        firstName: 'Cass',
        lastName: 'Customer',
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // A low-stock alert goes to EVERY active admin, not just this suite's — which
    // means a run on a seeded database files notifications against the real
    // admin@textileshop.com too. Deleting only `userId: adminId` left those behind,
    // and a developer's notification bell slowly filled up with "Low stock: Stock
    // Product alert-once" from months of test runs. Delete by TITLE (which carries
    // the tag) so the cleanup reaches every recipient.
    await prisma.notification.deleteMany({
      where: { title: { contains: TAG } },
    });
    await prisma.auditLog.deleteMany({ where: { userId: adminId } });

    // Movements before orders: movements -> orders is ON DELETE RESTRICT, so an
    // order that moved stock cannot be deleted while its ledger rows survive.
    // That restriction is the point (see the 20260712100000 migration) — in
    // production it means an order's audit trail can never be erased.
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, customerId] } },
    });
    await app.close();
  });

  /**
   * A product with a balanced opening ledger.
   *
   * The TAG is in the NAME as well as the SKU, and that is not cosmetic: a
   * low-stock notification identifies its product by name, so an untagged name
   * would leave alerts in the database that teardown could not find and delete.
   */
  async function seedProduct(label: string, stock: number, minimum = 0) {
    const product = await prisma.product.create({
      data: {
        name: `${TAG} ${label}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: 1000,
        stockQuantity: stock,
      },
    });

    const row = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: stock,
        quantityReserved: 0,
        minimumStockLevel: minimum,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: row.id,
        type: MovementType.INITIAL,
        quantityChange: stock,
      },
    });

    return product.id;
  }

  const stateOf = (productId: string) =>
    prisma.inventory.findUniqueOrThrow({ where: { productId } });

  const movementsOf = (productId: string) =>
    prisma.inventoryMovement.findMany({
      where: { inventory: { productId } },
      orderBy: { createdAt: 'asc' },
    });

  const placeOrder = (productId: string, quantity: number) =>
    orders.create(customerId, {
      items: [{ productId, quantity }],
      shippingAddress: address,
    });

  /** Notifications THIS admin received about THIS product. */
  const alertsFor = (label: string) =>
    prisma.notification.count({
      where: {
        userId: adminId,
        type: 'inventory.low_stock',
        title: { contains: `${TAG} ${label}` },
      },
    });

  // ═══ BR4: the floor cannot be broken from any direction ═══════════════════

  describe('BR4 — stock can never go below zero, or below what is reserved', () => {
    it('refuses an adjustment that would take stock below zero', async () => {
      const productId = await seedProduct('below-zero', 5);

      await expect(
        inventory.adjust(productId, -6, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(BadRequestException);

      // Pins the APP guard, not the CHECK constraint. See the header.
      await expect(
        inventory.adjust(productId, -6, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(/cannot go below zero/i);

      const state = await stateOf(productId);
      expect(state.quantityAvailable).toBe(5);
    });

    it('refuses to write off stock a customer has already reserved', async () => {
      const productId = await seedProduct('below-reserved', 10);
      await placeOrder(productId, 8); // reserved = 8, available = 10

      // Only 2 units are unspoken for. Damaging 5 would leave available=5 against
      // reserved=8 — eight customers promised what five units cannot satisfy.
      await expect(
        inventory.adjust(productId, -5, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        inventory.adjust(productId, -5, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(/reserved for orders already placed/i);

      const state = await stateOf(productId);
      expect(state.quantityAvailable).toBe(10);
      expect(state.quantityReserved).toBe(8);
    });

    it('allows an adjustment down to exactly the reserved level, but not one past it', async () => {
      const productId = await seedProduct('boundary', 10);
      await placeOrder(productId, 6); // reserved = 6

      // available 10 -> 6 is legal: every reservation is still honourable.
      await inventory.adjust(productId, -4, MovementType.DAMAGE, adminId);
      expect((await stateOf(productId)).quantityAvailable).toBe(6);

      // One more unit is not.
      await expect(
        inventory.adjust(productId, -1, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(BadRequestException);

      expect((await stateOf(productId)).quantityAvailable).toBe(6);
    });

    it('leaves NO trace when an adjustment is refused (the transaction rolls back)', async () => {
      const productId = await seedProduct('rollback', 3);
      const before = await movementsOf(productId);

      await expect(
        inventory.adjust(productId, -99, MovementType.DAMAGE, adminId, 'flood'),
      ).rejects.toThrow(BadRequestException);

      // A refused write must not leave a phantom movement or a phantom audit row.
      // If it did, the ledger would no longer reconcile — and the reconciler would
      // then be reporting a bug that never actually moved any stock.
      expect(await movementsOf(productId)).toHaveLength(before.length);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: adminId,
            action: 'inventory.adjust',
            after: { path: ['note'], equals: 'flood' },
          },
        }),
      ).toBe(0);
    });
  });

  // ═══ The admin may not forge the order lifecycle ══════════════════════════

  describe('an admin may only record PURCHASE, ADJUSTMENT or DAMAGE', () => {
    it.each([
      MovementType.SALE,
      MovementType.RESERVE,
      MovementType.RELEASE,
      MovementType.INITIAL,
    ])('refuses to let an admin hand-write a %s movement', async (type) => {
      const productId = await seedProduct(`forge-${type}`, 10);

      // An admin who could write a SALE by hand could invent revenue out of
      // nothing, and the analytics dashboard would faithfully report it.
      await expect(
        inventory.adjust(productId, -1, type, adminId),
      ).rejects.toThrow(/system movement/i);

      expect(await movementsOf(productId)).toHaveLength(1); // just INITIAL
    });

    it('refuses a PURCHASE that removes stock, and DAMAGE that adds it', async () => {
      const productId = await seedProduct('signs', 10);

      // The sign is implied by the type. "DAMAGE +50" is a data-entry error, and
      // accepting it would let a typo silently manufacture stock.
      await expect(
        inventory.adjust(productId, -5, MovementType.PURCHASE, adminId),
      ).rejects.toThrow(/purchase must increase/i);

      await expect(
        inventory.adjust(productId, 5, MovementType.DAMAGE, adminId),
      ).rejects.toThrow(/damage must decrease/i);

      expect((await stateOf(productId)).quantityAvailable).toBe(10);
    });
  });

  // ═══ The DAMAGE path, end to end ══════════════════════════════════════════

  describe('DAMAGE', () => {
    it('writes a signed movement traced to the admin, with the reason', async () => {
      const productId = await seedProduct('damage', 20);

      const result = await inventory.adjust(
        productId,
        -3,
        MovementType.DAMAGE,
        adminId,
        '3 metres water-damaged in the back store',
      );

      expect(result.available).toBe(17);

      const movements = await movementsOf(productId);
      const damage = movements.find((m) => m.type === MovementType.DAMAGE);

      expect(damage).toBeDefined();
      expect(damage!.quantityChange).toBe(-3);
      // Traceable to a PERSON. A bare "-3" is an unexplained loss, and unexplained
      // losses are how stock walks out of a shop.
      expect(damage!.userId).toBe(adminId);
      expect(damage!.orderId).toBeNull();
      expect(damage!.note).toBe('3 metres water-damaged in the back store');
    });

    /**
     * The FOR UPDATE lock, pinned.
     *
     * The guarded UPDATE inside adjust() is race-safe on its own — it cannot
     * oversell whatever commits underneath it, and the race test above proves that.
     * So why lock at all? Because the audit log records what the row looked like
     * BEFORE the write, and under READ COMMITTED an unlocked SELECT does not block
     * on someone else's uncommitted change: it quietly returns the OLD value.
     *
     * The write would still be correct. The audit log would be a lie. This test is
     * the difference between the two.
     *
     * Here a checkout reserves 8 units and holds its transaction open. An adjust()
     * that locks must WAIT and then audit `reserved: 8`. An adjust() that does not
     * lock sails past, reads `reserved: 0`, blocks later on the UPDATE anyway, and
     * writes an audit row describing a state that had already ceased to exist.
     */
    it('audits the state that was really there, not the one it happened to read first', async () => {
      const productId = await seedProduct('lock', 50);
      const row = await stateOf(productId);

      // A real order to hang the reservation on, so the ledger stays balanced and
      // the movement remains traceable (reserve() is the production code path).
      const decoy = await seedProduct('lock-decoy', 5);
      const order = await placeOrder(decoy, 1);

      let held = false;

      // A checkout, mid-flight: it has reserved the stock but has not committed.
      const checkout = prisma.$transaction(
        async (tx) => {
          await inventory.reserve(tx, productId, 8, order.id);
          held = true;
          await new Promise((resolve) => setTimeout(resolve, 400));
        },
        { timeout: 20_000 },
      );

      // Let the checkout take the row lock before the admin arrives.
      while (!held) await new Promise((resolve) => setTimeout(resolve, 10));

      await Promise.all([
        checkout,
        inventory.adjust(
          productId,
          5,
          MovementType.PURCHASE,
          adminId,
          'delivery',
        ),
      ]);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'inventory.adjust', entityId: row.id },
        orderBy: { createdAt: 'desc' },
      });
      const before = log.before as { available: number; reserved: number };

      // 8, not 0. If this reads 0, the audit trail is describing a moment that had
      // already passed by the time the write landed.
      expect(before.reserved).toBe(8);
      expect(before.available).toBe(50);

      const state = await stateOf(productId);
      expect(state.quantityAvailable).toBe(55);
      expect(state.quantityReserved).toBe(8);
    }, 30_000);

    it('records who did it and what it was before, in the audit log', async () => {
      const productId = await seedProduct('audit', 12);
      await inventory.adjust(
        productId,
        -2,
        MovementType.DAMAGE,
        adminId,
        'torn',
      );

      const row = await prisma.inventory.findUniqueOrThrow({
        where: { productId },
      });
      const log = await prisma.auditLog.findFirst({
        where: {
          userId: adminId,
          action: 'inventory.adjust',
          entityId: row.id,
        },
      });

      expect(log).toBeDefined();
      expect(log!.before).toMatchObject({ available: 12, reserved: 0 });
      expect(log!.after).toMatchObject({
        available: 10,
        change: -2,
        type: 'DAMAGE',
      });
    });

    it('keeps the sellable cache in step with the ledger', async () => {
      const productId = await seedProduct('cache', 30);
      await placeOrder(productId, 4); // reserved 4 -> sellable 26
      await inventory.adjust(productId, -6, MovementType.DAMAGE, adminId);

      const state = await stateOf(productId);
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });

      expect(state.quantityAvailable).toBe(24);
      expect(state.quantityReserved).toBe(4);
      expect(product.stockQuantity).toBe(20); // 24 - 4
    });
  });

  // ═══ FR-018: the alert that must not cry wolf ═════════════════════════════

  describe('FR-018 — the low-stock alert fires ONCE, not on every request', () => {
    it('alerts when stock crosses the minimum, and stays silent while it stays low', async () => {
      const productId = await seedProduct('alert-once', 10, 5);
      const name = 'alert-once';

      // Above the line. Nothing to say.
      await inventory.adjust(productId, -3, MovementType.DAMAGE, adminId); // 7
      expect(await alertsFor(name)).toBe(0);

      // Crosses it. Say it once.
      await inventory.adjust(productId, -3, MovementType.DAMAGE, adminId); // 4 <= 5
      expect(await alertsFor(name)).toBe(1);

      // Still low. Saying it four more times is how an owner learns to ignore the
      // bell — and an alert that is ignored is worse than no alert at all.
      await inventory.adjust(productId, -1, MovementType.DAMAGE, adminId); // 3
      await inventory.adjust(productId, -1, MovementType.DAMAGE, adminId); // 2
      await inventory.adjust(productId, -1, MovementType.DAMAGE, adminId); // 1

      // EXACTLY one. Not "at most one" — asserting `<= 1` would also pass if the
      // alert never fired at all, which is the opposite failure and just as bad.
      expect(await alertsFor(name)).toBe(1);
    });

    it('re-arms once stock recovers, so the NEXT dip is reported', async () => {
      const productId = await seedProduct('alert-rearm', 10, 5);
      const name = 'alert-rearm';

      await inventory.adjust(productId, -6, MovementType.DAMAGE, adminId); // 4 -> alert 1
      expect(await alertsFor(name)).toBe(1);

      // A delivery arrives and lifts it clear of the minimum.
      await inventory.adjust(productId, 20, MovementType.PURCHASE, adminId); // 24

      // It runs low again. The owner MUST be told again — this is the case that
      // the `lowStockNotified` flag breaks if the restock path forgets to clear it,
      // and the failure is silent: the alert simply never fires again, forever.
      await inventory.adjust(productId, -20, MovementType.DAMAGE, adminId); // 4
      expect(await alertsFor(name)).toBe(2);
    });

    it('fires when a SALE — not just an admin edit — takes stock under the line', async () => {
      const productId = await seedProduct('alert-sale', 10, 5);
      const name = 'alert-sale';

      const order = await placeOrder(productId, 7); // reserve only: available still 10
      expect(await alertsFor(name)).toBe(0);

      await orders.confirmOrder(order.id, adminId); // SALE: available 3 <= 5
      expect(await alertsFor(name)).toBe(1);
    });

    it('fires when the admin RAISES the minimum above current stock', async () => {
      const productId = await seedProduct('alert-minimum', 10, 2);
      const name = 'alert-minimum';

      expect(await alertsFor(name)).toBe(0);

      // Nothing moved, but the definition of "low" did. 10 units of a fabric you
      // now want 20 of on hand is a reorder signal, and it should behave like one.
      await inventory.setMinimum(productId, 20, adminId);
      expect(await alertsFor(name)).toBe(1);
    });
  });

  // ═══ Concurrency: an admin edit racing a customer's checkout ══════════════

  describe('an adjustment racing a live order', () => {
    it('lets exactly one of them win, and never oversells', async () => {
      // 10 on hand. An order wants 6; the admin wants to write off 6. Both cannot
      // be true — whichever lands second must be refused, whichever it is.
      for (let attempt = 0; attempt < 8; attempt++) {
        const productId = await seedProduct(`race-${attempt}`, 10);

        const results = await Promise.allSettled([
          placeOrder(productId, 6),
          inventory.adjust(productId, -6, MovementType.DAMAGE, adminId),
        ]);

        const won = results.filter((r) => r.status === 'fulfilled').length;
        expect({ attempt, won }).toEqual({ attempt, won: 1 });

        // Whoever lost, lost cleanly — through a guard, not a constraint violation.
        const loser = results.find((r) => r.status === 'rejected');
        expect((loser as PromiseRejectedResult).reason).toBeInstanceOf(
          BadRequestException,
        );

        // And the invariant that matters holds either way: you cannot have promised
        // more cloth than you hold.
        const state = await stateOf(productId);
        expect(state.quantityAvailable).toBeGreaterThanOrEqual(
          state.quantityReserved,
        );
      }
    }, 60_000);
  });

  // ═══ The headline acceptance criterion ════════════════════════════════════

  describe('acceptance: reconciliation survives a storm of 50 mixed operations', () => {
    it('leaves the ledger and the totals in perfect agreement', async () => {
      const productId = await seedProduct('storm', 200, 10);

      // Deterministic PRNG. A storm that cannot be replayed is a storm you cannot
      // debug: when this fails in CI, the same seed reproduces the same 50 moves.
      let seed = 20260712;
      const rand = (n: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
      };

      const pending: string[] = [];
      const confirmed: string[] = [];
      const outcome = { ok: 0, refused: 0 };

      // Every operation the system can perform on stock, mixed. Some WILL be
      // refused (BR4) — that is a legitimate outcome, not a test failure. What is
      // NOT negotiable is that the ledger balances afterwards either way, because
      // a refused write must leave nothing behind.
      const run = async (op: () => Promise<unknown>) => {
        try {
          await op();
          outcome.ok++;
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          outcome.refused++;
        }
      };

      for (let i = 0; i < 50; i++) {
        const roll = rand(10);

        if (roll <= 2) {
          await run(async () => {
            const order = await placeOrder(productId, 1 + rand(5));
            pending.push(order.id);
          });
        } else if (roll <= 4 && pending.length > 0) {
          await run(async () => {
            const id = pending.pop()!;
            await orders.confirmOrder(id, adminId);
            confirmed.push(id);
          });
        } else if (roll === 5 && pending.length > 0) {
          await run(() =>
            orders.cancel(pending.pop()!, {
              id: adminId,
              role: UserRole.ADMIN,
            }),
          );
        } else if (roll === 6 && confirmed.length > 0) {
          await run(() =>
            orders.cancel(confirmed.pop()!, {
              id: adminId,
              role: UserRole.ADMIN,
            }),
          );
        } else if (roll === 7) {
          await run(() =>
            inventory.adjust(
              productId,
              1 + rand(30),
              MovementType.PURCHASE,
              adminId,
            ),
          );
        } else if (roll === 8) {
          await run(() =>
            inventory.adjust(
              productId,
              -(1 + rand(12)),
              MovementType.DAMAGE,
              adminId,
            ),
          );
        } else {
          const delta = rand(2) === 0 ? 1 + rand(10) : -(1 + rand(10));
          await run(() =>
            inventory.adjust(
              productId,
              delta,
              MovementType.ADJUSTMENT,
              adminId,
            ),
          );
        }
      }

      // The storm has to have actually stormed. Without this, a bug that made every
      // operation throw would leave a trivially-balanced ledger and pass silently.
      expect(outcome.ok).toBeGreaterThan(20);

      // THE assertion: the real reconciler — the same function `npm run reconcile`
      // and CI call, not a copy of it — finds nothing wrong.
      const drift = await findDrift(prisma, TAG);
      expect(drift).toEqual([]);
    }, 120_000);

    it('proves the reconciler can actually SEE drift (it is not just returning [])', async () => {
      const productId = await seedProduct('canary', 40);

      // A green reconciler is only worth something if a red one is reachable. So:
      // corrupt the totals behind the ledger's back, exactly as an escaped write
      // would, and require the reconciler to catch it.
      await prisma.inventory.update({
        where: { productId },
        data: { quantityAvailable: 999 },
      });

      const drift = await findDrift(prisma, `${TAG}-canary`);
      expect(drift.length).toBeGreaterThan(0);
      expect(drift.map((d) => d.problem)).toContain(
        'quantity_available disagrees with the ledger',
      );

      // Put it back so the suite's own teardown is honest.
      await prisma.inventory.update({
        where: { productId },
        data: { quantityAvailable: 40 },
      });
    });
  });

  // ═══ Reads ════════════════════════════════════════════════════════════════

  describe('reads', () => {
    it('reports OK / LOW / OUT as three different problems', async () => {
      const ok = await seedProduct('status-ok', 50, 5);
      const low = await seedProduct('status-low', 5, 5);
      const out = await seedProduct('status-out', 0, 5);

      const shaped = async (id: string) => (await inventory.findOne(id)).status;

      // LOW still sells while you reorder. OUT is turning customers away right now.
      // Collapsing them into one badge hides the difference that matters.
      expect(await shaped(ok)).toBe('OK');
      expect(await shaped(low)).toBe('LOW');
      expect(await shaped(out)).toBe('OUT');
    });

    it('lists the ledger newest-first, with every row traced to an order or an admin', async () => {
      const productId = await seedProduct('ledger', 10);
      await inventory.adjust(
        productId,
        5,
        MovementType.PURCHASE,
        adminId,
        'delivery',
      );
      const order = await placeOrder(productId, 2);
      await orders.confirmOrder(order.id, adminId);

      const { items } = await inventory.movements(productId);

      expect(items[0].type).toBe(MovementType.SALE);
      expect(items[0].orderNumber).toMatch(/^TXL-/);
      expect(items[0].adminName).toBeNull();

      const purchase = items.find((m) => m.type === MovementType.PURCHASE)!;
      expect(purchase.adminName).toBe('Ivy Admin');
      expect(purchase.orderNumber).toBeNull();

      // The acceptance criterion, stated as an assertion: nothing moved for no
      // reason. INITIAL is the opening balance and answers "why" by its type.
      for (const item of items) {
        if (item.type === MovementType.INITIAL) continue;
        expect(item.orderNumber ?? item.adminName).not.toBeNull();
      }
    });

    it('filters to just the products that need reordering', async () => {
      const low = await seedProduct('filter-low', 2, 10);
      await seedProduct('filter-fine', 500, 10);

      const { items } = await inventory.list({
        search: `${TAG}-filter`,
        lowStockOnly: true,
      });

      expect(items.map((i) => i.productId)).toEqual([low]);
    });
  });
});
