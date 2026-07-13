import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, OrderStatus, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreateOrderDto } from '../src/orders/dto/create-order.dto';

/**
 * Stock reservation under concurrency — decisions D3 + BR4, plan Session 3.2.
 *
 * This test exists because a mocked one is worthless here. The oversell guard is
 * a single conditional UPDATE inside a transaction:
 *
 *   UPDATE inventory
 *      SET quantity_reserved = quantity_reserved + $qty
 *    WHERE product_id = $id
 *      AND quantity_available - quantity_reserved >= $qty
 *
 * Whether that actually serializes two simultaneous checkouts is a property of
 * Postgres' row locking, not of our TypeScript. Stubbing `inventory.reserve()`
 * with a jest.fn() would assert only that we call a function we wrote.
 *
 * So: a real database, real transactions, real Promise.all.
 *
 * IMPORTANT — why the assertions check the *reason* for each rejection, not just
 * that one happened: stock has TWO independent defences.
 *
 *   1. the guarded UPDATE above (application layer), and
 *   2. the `inventory_non_negative` CHECK constraint (database layer), which
 *      enforces `quantity_reserved <= quantity_available`.
 *
 * Deleting (1) still leaves (2), so the loser still fails — just with a raw
 * Postgres constraint error instead of a clean 400. A test that only asserted
 * "one order failed" would therefore pass with the application guard removed,
 * which is exactly what happened the first time this file was written.
 * Asserting BadRequestException pins the behaviour to layer 1 and leaves layer 2
 * as the backstop it is meant to be.
 *
 * Requires a running Postgres reachable via DATABASE_URL, migrated. Run with:
 *   npm run test:integration
 */

const RACE_REPEATS = 10;

// Every row this suite creates is tagged so cleanup can never touch real data.
const TAG = `racetest-${Date.now()}`;

describe('Stock reservation race (D3 / BR4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let userId: string;

  const address = {
    fullName: 'Race Tester',
    addressLine1: '1 Concurrency Lane',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00100',
    country: 'LK',
  };

  const orderFor = (productId: string, quantity = 1): CreateOrderDto => ({
    items: [{ productId, quantity }],
    shippingAddress: address,
  });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);

    const user = await prisma.user.create({
      data: {
        email: `${TAG}@example.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Race',
        lastName: 'Tester',
        role: UserRole.CUSTOMER,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Teardown order is dictated by the FKs, and it is NOT arbitrary:
    //
    //   movements -> orders is ON DELETE RESTRICT, so an order that moved stock
    //   cannot be deleted while its ledger rows survive. (That restriction is the
    //   point: in production it means an order's audit trail can never be erased.
    //   See the 20260712100000 migration.) So the movements go first, explicitly.
    //
    // Then orders (cascading their items), then products (cascading the now-empty
    // inventory rows), then the user.
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  /** A product with exactly `stock` sellable units and a balanced ledger. */
  async function seedProduct(stock: number, label: string) {
    const product = await prisma.product.create({
      data: {
        name: `Race Product ${label}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: 1000,
        stockQuantity: stock,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: stock,
        quantityReserved: 0,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: MovementType.INITIAL,
        quantityChange: stock,
      },
    });

    return product.id;
  }

  async function ledgerOf(productId: string) {
    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productId },
      include: { movements: true },
    });

    const sum = (types: MovementType[]) =>
      inventory.movements
        .filter((m) => types.includes(m.type))
        .reduce((acc, m) => acc + m.quantityChange, 0);

    return {
      available: inventory.quantityAvailable,
      reserved: inventory.quantityReserved,
      // The reconciliation invariant, stated explicitly:
      //   available == SUM(INITIAL, SALE, PURCHASE, ADJUSTMENT, DAMAGE)
      //   reserved  == SUM(RESERVE, RELEASE, SALE)
      availableLedger: sum([
        MovementType.INITIAL,
        MovementType.SALE,
        MovementType.PURCHASE,
        MovementType.ADJUSTMENT,
        MovementType.DAMAGE,
      ]),
      reservedLedger: sum([
        MovementType.RESERVE,
        MovementType.RELEASE,
        MovementType.SALE,
      ]),
      reserveMovements: inventory.movements.filter(
        (m) => m.type === MovementType.RESERVE,
      ).length,
    };
  }

  /**
   * The loser must be turned away by the application guard (a clean 400), not by
   * the database CHECK constraint (a 500-shaped Prisma error). See the header.
   */
  function expectRejectedByAppGuard(results: PromiseSettledResult<unknown>[]) {
    const rejections = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    for (const rejection of rejections) {
      expect(rejection.reason).toBeInstanceOf(BadRequestException);
      expect(String((rejection.reason as Error).message)).toMatch(
        /insufficient stock/i,
      );
    }

    return rejections.length;
  }

  it(`lets exactly one of two simultaneous orders win, ${RACE_REPEATS}x in a row`, async () => {
    for (let attempt = 0; attempt < RACE_REPEATS; attempt++) {
      const productId = await seedProduct(1, `race-${attempt}`);

      const results = await Promise.allSettled([
        orders.create(userId, orderFor(productId)),
        orders.create(userId, orderFor(productId)),
      ]);

      const won = results.filter((r) => r.status === 'fulfilled').length;
      const lost = expectRejectedByAppGuard(results);

      expect({ attempt, won, lost }).toEqual({ attempt, won: 1, lost: 1 });

      const ledger = await ledgerOf(productId);

      // The single unit is reserved, not sold, and not double-reserved.
      expect(ledger.reserved).toBe(1);
      expect(ledger.available).toBe(1);
      expect(ledger.reserveMovements).toBe(1);

      // And the ledger still balances.
      expect(ledger.available).toBe(ledger.availableLedger);
      expect(ledger.reserved).toBe(ledger.reservedLedger);
    }
  }, 60_000);

  it('never oversells when more orders race than there is stock', async () => {
    const stock = 3;
    const contenders = 8;
    const productId = await seedProduct(stock, 'oversell');

    const results = await Promise.allSettled(
      Array.from({ length: contenders }, () =>
        orders.create(userId, orderFor(productId)),
      ),
    );

    const won = results.filter((r) => r.status === 'fulfilled').length;
    const lost = expectRejectedByAppGuard(results);

    expect(won).toBe(stock);
    expect(lost).toBe(contenders - stock);

    const ledger = await ledgerOf(productId);
    expect(ledger.reserved).toBe(stock);
    expect(ledger.reserveMovements).toBe(stock);
    expect(ledger.available).toBe(ledger.availableLedger);
    expect(ledger.reserved).toBe(ledger.reservedLedger);
  }, 60_000);

  it('keeps the database CHECK constraint as a second line of defence (BR4)', async () => {
    const rows = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
       WHERE conname = 'inventory_non_negative'`;

    // If a future migration drops this, the app guard becomes the only thing
    // standing between a logic bug and negative stock.
    expect(rows).toHaveLength(1);
    expect(rows[0].definition).toMatch(
      /quantity_reserved <= quantity_available/,
    );
  });

  it('rejects a single order larger than available stock (BR4)', async () => {
    const productId = await seedProduct(2, 'too-big');

    await expect(
      orders.create(userId, orderFor(productId, 3)),
    ).rejects.toThrow();

    const ledger = await ledgerOf(productId);
    expect(ledger.reserved).toBe(0);
    expect(ledger.reserveMovements).toBe(0);
    expect(ledger.available).toBe(2);
  });

  it('writes a null -> PENDING history row for the winning order', async () => {
    const productId = await seedProduct(1, 'history');

    const order = await orders.create(userId, orderFor(productId));

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(history).toHaveLength(1);
    expect(history[0].fromStatus).toBeNull();
    expect(history[0].toStatus).toBe(OrderStatus.PENDING);
  });
});
