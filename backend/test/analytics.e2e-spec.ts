import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Dashboard analytics against a hand-computed fixture (plan Session 8.1).
 *
 * The dashboard this replaced summed `orders.reduce(...)` over the first page of
 * ten orders and counted every status, so it reported revenue that included
 * CANCELLED and unpaid orders. On the seeded dev database it claimed Rs 62,500
 * against a true figure of Rs 21,900.
 *
 * These assertions are exact, not approximate. Every number below is derived by
 * hand from the fixture, and asserted as a DELTA from a baseline so the suite is
 * safe to run against a database that already holds data.
 */
describe('Admin dashboard analytics (Session 8.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let analytics: AnalyticsService;

  const TAG = `analytics-${Date.now()}`;
  let userId: string;
  let productId: string;

  /** Only this one is real money. Everything else must be excluded. */
  const PAID_TOTAL = new Prisma.Decimal('1000.00');
  const UNPAID_TOTAL = new Prisma.Decimal('2000.00');
  const REFUNDED_TOTAL = new Prisma.Decimal('5000.00');
  const NO_PAYMENT_TOTAL = new Prisma.Decimal('7000.00');

  let baseline: {
    revenue: Prisma.Decimal;
    totalOrders: number;
    pendingOrders: number;
  };

  async function makeOrder(
    total: Prisma.Decimal,
    status: OrderStatus,
    payment: PaymentStatus | null,
    withItem = false,
  ) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${TAG}-${total.toString()}`,
        userId,
        subtotal: total,
        total,
        status,
      },
    });

    if (withItem) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          quantity: 2,
          unitPrice: total.div(2),
          totalPrice: total,
        },
      });
    }

    if (payment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: total,
          status: payment,
          method: PaymentMethod.COD,
          currency: 'LKR',
          paidAt: payment === PaymentStatus.COMPLETED ? new Date() : null,
        },
      });
    }

    return order.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    analytics = app.get(AnalyticsService);

    const before = await analytics.getTotals(analytics.resolveRange());
    baseline = {
      revenue: new Prisma.Decimal(before.revenue),
      totalOrders: before.totalOrders,
      pendingOrders: before.pendingOrders,
    };

    const user = await prisma.user.create({
      data: {
        email: `${TAG}@example.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Analytics',
        lastName: 'Fixture',
        role: UserRole.CUSTOMER,
      },
    });
    userId = user.id;

    const product = await prisma.product.create({
      data: {
        name: `Analytics Product ${TAG}`,
        slug: TAG,
        sku: TAG,
        price: new Prisma.Decimal('500.00'),
        stockQuantity: 100,
      },
    });
    productId = product.id;

    // The fixture: exactly one order represents money actually received.
    await makeOrder(PAID_TOTAL, OrderStatus.CONFIRMED, PaymentStatus.COMPLETED, true);
    await makeOrder(UNPAID_TOTAL, OrderStatus.CONFIRMED, PaymentStatus.PENDING);
    await makeOrder(REFUNDED_TOTAL, OrderStatus.CANCELLED, PaymentStatus.REFUNDED);
    await makeOrder(NO_PAYMENT_TOTAL, OrderStatus.PENDING, null);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.product.deleteMany({ where: { sku: TAG } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('counts ONLY completed payments as revenue', async () => {
    const totals = await analytics.getTotals(analytics.resolveRange());
    const delta = new Prisma.Decimal(totals.revenue).minus(baseline.revenue);

    // Rs 1000 paid. The 2000 unpaid, 5000 refunded and 7000 unbilled are excluded.
    expect(delta.toFixed(2)).toBe(PAID_TOTAL.toFixed(2));
  });

  it('returns money as a decimal string, never a float', async () => {
    const totals = await analytics.getTotals(analytics.resolveRange());

    expect(typeof totals.revenue).toBe('string');
    expect(totals.revenue).toMatch(/^-?\d+\.\d{2}$/);
  });

  it('counts every order in totalOrders, regardless of payment', async () => {
    const totals = await analytics.getTotals(analytics.resolveRange());
    expect(totals.totalOrders - baseline.totalOrders).toBe(4);
  });

  it('counts only PENDING orders in pendingOrders', async () => {
    const totals = await analytics.getTotals(analytics.resolveRange());
    expect(totals.pendingOrders - baseline.pendingOrders).toBe(1);
  });

  it('attributes top-product revenue only to paid orders', async () => {
    const top = await analytics.getTopProducts(analytics.resolveRange(), 50);
    const mine = top.find((p) => p.productId === productId);

    // The product appears once, worth exactly the paid order's line total.
    expect(mine).toBeDefined();
    expect(mine!.revenue).toBe(PAID_TOTAL.toFixed(2));
    expect(mine!.quantity).toBe(2);
  });

  it('zero-fills salesByDay so an empty day is 0.00, not absent', async () => {
    const range = analytics.resolveRange();
    const series = await analytics.getSalesByDay(range);

    // 30-day window, inclusive of both endpoints.
    expect(series).toHaveLength(31);
    for (const point of series) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(point.revenue).toMatch(/^\d+\.\d{2}$|^0$/);
      expect(Number.isInteger(point.orders)).toBe(true);
    }
  });

  it('returns counts as numbers, not BigInt (COUNT(*) is bigint in Postgres)', async () => {
    const totals = await analytics.getTotals(analytics.resolveRange());

    // A bigint here would blow up JSON.stringify on the response.
    expect(typeof totals.totalOrders).toBe('number');
    expect(() => JSON.stringify(totals)).not.toThrow();
  });
});
