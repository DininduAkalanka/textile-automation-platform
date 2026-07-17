import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { findDrift } from '../src/inventory/reconcile';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductionService } from '../src/production/production.service';

/**
 * Order management (plan Session 7.1) — the acceptance criteria as tests:
 *
 *   - Cancel in every legal state leaves the ledger reconciled (findDrift, the
 *     same function `npm run reconcile` calls — see inventory.e2e-spec.ts).
 *   - An IDOR test proves object-level authorization, not just role checks.
 *   - The admin action list (adminActions) is the single source the frontend
 *     disables buttons from — order.machine.spec.ts pins the pure rules; this
 *     file pins that OrdersService actually wires them to real rows.
 *
 * Real Postgres, real transactions — the refund-acknowledgment gate and the
 * customer-vs-admin cancel boundary are exactly the kind of branch a mocked
 * Prisma would let you assert the wrong thing about.
 */
const TAG = `ordertest-${Date.now()}`;

describe('Order management (Phase 7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;

  let adminId: string;
  let customerId: string;
  let otherCustomerId: string;
  let retailProductId: string; // fulfillment-only: no measurements, not UNIFORM/CUSTOM
  let uniformProductId: string; // enters production (D8)

  const address = {
    fullName: 'Order Tester',
    addressLine1: '1 Ledger Row',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00100',
    country: 'LK',
  };

  const uniformMeasurements = {
    personName: 'Kid',
    values: {
      chest: 80,
      waist: 70,
      shoulder: 40,
      sleeveLength: 55,
      shirtLength: 65,
      trouserWaist: 70,
      hip: 85,
      trouserLength: 95,
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);

    adminId = (
      await prisma.user.create({
        data: {
          email: `${TAG}-admin@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Ada',
          lastName: 'Admin',
          role: UserRole.ADMIN,
        },
      })
    ).id;

    customerId = (
      await prisma.user.create({
        data: {
          email: `${TAG}-cust@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Cara',
          lastName: 'Customer',
          role: UserRole.CUSTOMER,
        },
      })
    ).id;

    otherCustomerId = (
      await prisma.user.create({
        data: {
          email: `${TAG}-other@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Otis',
          lastName: 'Other',
          role: UserRole.CUSTOMER,
        },
      })
    ).id;

    retailProductId = await seedProduct('retail', {
      productType: ProductType.READY_MADE,
      requiresMeasurement: false,
    });
    uniformProductId = await seedProduct('uniform', {
      productType: ProductType.UNIFORM,
      requiresMeasurement: true,
    });
  });

  afterAll(async () => {
    // Movements before orders: ON DELETE RESTRICT means an order that moved
    // stock cannot be deleted while its ledger rows survive (20260712100000).
    await prisma.notification.deleteMany({
      where: { title: { contains: TAG } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.productionTask.deleteMany({
      where: { order: { userId: { in: [customerId, otherCustomerId] } } },
    });
    await prisma.order.deleteMany({
      where: { userId: { in: [customerId, otherCustomerId] } },
    });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, customerId, otherCustomerId] } },
    });
    await app.close();
  });

  async function seedProduct(
    label: string,
    extra: { productType: ProductType; requiresMeasurement: boolean },
  ) {
    const product = await prisma.product.create({
      data: {
        name: `${TAG} ${label}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: 1000,
        stockQuantity: 500,
        ...extra,
      },
    });
    const inv = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: 500,
        quantityReserved: 0,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: MovementType.INITIAL,
        quantityChange: 500,
      },
    });
    return product.id;
  }

  const placeRetailOrder = (as: string = customerId) =>
    orders.create(as, {
      items: [{ productId: retailProductId, quantity: 2 }],
      shippingAddress: address,
    });

  const placeUniformOrder = (as: string = customerId) =>
    orders.create(as, {
      items: [
        {
          productId: uniformProductId,
          quantity: 1,
          measurements: uniformMeasurements,
        },
      ],
      shippingAddress: address,
    });

  const notificationsFor = (userId: string, label: string) =>
    prisma.notification.findMany({
      where: { userId, title: { contains: `${TAG}-${label}` } },
      orderBy: { createdAt: 'asc' },
    });

  // ═══ Cancel: release/restock per legal state, ledger stays reconciled ═════

  describe('cancel — release/restock per legal state', () => {
    it('releases a PENDING order (never sold)', async () => {
      const order = await placeRetailOrder();
      const before = await prisma.inventory.findUniqueOrThrow({
        where: { productId: retailProductId },
      });

      await orders.cancel(order.id, { id: adminId, role: UserRole.ADMIN });

      const after = await prisma.inventory.findUniqueOrThrow({
        where: { productId: retailProductId },
      });
      // Reserved returns to zero; available is untouched — nothing was ever sold.
      expect(after.quantityReserved).toBe(before.quantityReserved - 2);
      expect(after.quantityAvailable).toBe(before.quantityAvailable);

      const cancelled = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    });

    it('restocks a CONFIRMED order (already sold)', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId); // reserve -> SALE

      const before = await prisma.inventory.findUniqueOrThrow({
        where: { productId: retailProductId },
      });

      await orders.cancel(order.id, { id: adminId, role: UserRole.ADMIN });

      const after = await prisma.inventory.findUniqueOrThrow({
        where: { productId: retailProductId },
      });
      expect(after.quantityAvailable).toBe(before.quantityAvailable + 2);
    });

    it('is illegal once production has started, after completion, or after delivery', async () => {
      // Drive a fresh order all the way to IN_PRODUCTION.
      const order = await placeUniformOrder();
      await orders.confirmOrder(order.id, adminId);
      const confirmed = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(confirmed.status).toBe(OrderStatus.CONFIRMED);

      // Start the one production task -> order follows to IN_PRODUCTION.
      const production = app.get(ProductionService);
      const [task] = await prisma.productionTask.findMany({
        where: { orderId: order.id },
      });
      const worker = await prisma.worker.create({
        data: {
          userId: (
            await prisma.user.create({
              data: {
                email: `${TAG}-w-${task.id}@example.test`,
                passwordHash: 'x',
                emailVerified: true,
                firstName: 'W',
                lastName: 'W',
                role: UserRole.WORKER,
              },
            })
          ).id,
        },
      });
      await production.assign(task.id, worker.id);
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);

      const inProduction = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(inProduction.status).toBe(OrderStatus.IN_PRODUCTION);

      await expect(
        orders.cancel(order.id, { id: adminId, role: UserRole.ADMIN }),
      ).rejects.toThrow(BadRequestException);

      // Cleanup this test's extra worker/user so afterAll's product delete is clean.
      await prisma.productionTask.deleteMany({ where: { id: task.id } });
      await prisma.worker.delete({ where: { id: worker.id } });
      await prisma.user.delete({ where: { id: worker.userId } });
    });

    it('leaves the ledger reconciled after a mix of legal cancels — the plan AC, literally', async () => {
      const a = await placeRetailOrder(); // will cancel from PENDING
      const b = await placeRetailOrder(); // will cancel from CONFIRMED
      await orders.confirmOrder(b.id, adminId);

      await orders.cancel(a.id, { id: adminId, role: UserRole.ADMIN });
      await orders.cancel(b.id, { id: adminId, role: UserRole.ADMIN });

      const drift = await findDrift(prisma, `${TAG}-retail`);
      expect(drift).toEqual([]);
    });
  });

  // ═══ Cancel: the refund-acknowledgment gate ════════════════════════════════

  describe('cancel — the refund acknowledgment gate', () => {
    it('refuses to cancel a fully-paid order without acknowledging the refund', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.COMPLETED,
          method: PaymentMethod.PAYHERE,
        },
      });

      await expect(
        orders.cancel(order.id, { id: adminId, role: UserRole.ADMIN }),
      ).rejects.toThrow(/acknowledging that a refund must be issued/i);

      // Refused cleanly — the order and the payment are UNTOUCHED, not half-cancelled.
      const stillConfirmed = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(stillConfirmed.status).toBe(OrderStatus.CONFIRMED);
    });

    it('cancels and marks the payment REFUNDED once acknowledged', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.COMPLETED,
          method: PaymentMethod.PAYHERE,
        },
      });

      await orders.cancel(
        order.id,
        { id: adminId, role: UserRole.ADMIN },
        { acknowledgeRefund: true },
      );

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      expect(payment.status).toBe(PaymentStatus.REFUNDED);
    });

    it('marks an uncollected payment FAILED on cancel — nothing to acknowledge, nothing was ever collected', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId); // COD confirms immediately (payments.service.ts)
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.PENDING, // collected on delivery — never happened
          method: PaymentMethod.COD,
        },
      });

      // No acknowledgeRefund needed: nothing was ever completed.
      await orders.cancel(order.id, { id: adminId, role: UserRole.ADMIN });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      expect(payment.status).toBe(PaymentStatus.FAILED);
    });
  });

  // ═══ Cancel: who may do it ═════════════════════════════════════════════════

  describe('cancel — customer self-service vs admin judgment', () => {
    it('lets a customer cancel their own PENDING order', async () => {
      const order = await placeRetailOrder();
      const result = await orders.cancel(order.id, {
        id: customerId,
        role: UserRole.CUSTOMER,
      });
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('refuses a customer cancelling their own CONFIRMED order themselves', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);

      await expect(
        orders.cancel(order.id, { id: customerId, role: UserRole.CUSTOMER }),
      ).rejects.toThrow(ForbiddenException);

      // An admin CAN, though — the same order, the same state, a different actor.
      const result = await orders.cancel(order.id, {
        id: adminId,
        role: UserRole.ADMIN,
      });
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    /**
     * The IDOR test the plan's acceptance criteria explicitly calls for. NotFound,
     * not Forbidden — a 403 would confirm the order EXISTS and belongs to someone
     * else, which is itself a small leak. "Not found" is what a customer sees for
     * a typo'd id AND for someone else's real one, indistinguishably.
     */
    it('IDOR: another customer cannot cancel — or even see — this order', async () => {
      const order = await placeRetailOrder(customerId);

      await expect(
        orders.cancel(order.id, {
          id: otherCustomerId,
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        orders.findById(order.id, { userId: otherCustomerId }),
      ).rejects.toThrow(NotFoundException);

      // It is exactly as untouched as if the request had never been made.
      const untouched = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(untouched.status).toBe(OrderStatus.PENDING);
    });

    it("an admin can read any customer's order", async () => {
      const order = await placeRetailOrder(customerId);
      const seen = await orders.findById(order.id, { isAdmin: true });
      expect(seen.id).toBe(order.id);
    });
  });

  // ═══ advance — fulfillment-only orders ═════════════════════════════════════

  describe('advance', () => {
    it('moves a fulfillment-only CONFIRMED order straight to COMPLETED', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);

      const result = await orders.advance(order.id, adminId);
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('refuses to advance an order that has production tasks', async () => {
      const order = await placeUniformOrder();
      await orders.confirmOrder(order.id, adminId);

      await expect(orders.advance(order.id, adminId)).rejects.toThrow(
        /production tasks/i,
      );

      const untouched = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(untouched.status).toBe(OrderStatus.CONFIRMED);
    });

    it('refuses to advance from anywhere other than CONFIRMED', async () => {
      const order = await placeRetailOrder();
      // Still PENDING.
      await expect(orders.advance(order.id, adminId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ═══ deliver ════════════════════════════════════════════════════════════════

  describe('deliver', () => {
    it('moves COMPLETED -> DELIVERED', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await orders.advance(order.id, adminId);

      const result = await orders.deliver(order.id, adminId);
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('refuses to deliver an order that is not yet COMPLETED', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);

      await expect(orders.deliver(order.id, adminId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ═══ Notifications reach the customer (plan task 4) ═══════════════════════

  describe('notifications', () => {
    it('placing an order (PENDING) notifies no one — nothing to say about your own click', async () => {
      const before = await notificationsFor(customerId, 'retail');
      await placeRetailOrder();
      const after = await notificationsFor(customerId, 'retail');
      expect(after.length).toBe(before.length);
    });

    it('confirming notifies the CUSTOMER who placed it, not the admin who confirmed it', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);

      const customerNotified = await prisma.notification.findFirst({
        where: {
          userId: customerId,
          type: 'order.status_changed',
          title: { contains: order.orderNumber },
        },
      });
      const adminNotified = await prisma.notification.findFirst({
        where: {
          userId: adminId,
          type: 'order.status_changed',
          title: { contains: order.orderNumber },
        },
      });

      expect(customerNotified).not.toBeNull();
      expect(customerNotified!.title).toContain('confirmed');
      expect(adminNotified).toBeNull();
    });

    it('cancelling a paid order carries the refund detail in the notification body', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.COMPLETED,
          method: PaymentMethod.PAYHERE,
        },
      });

      await orders.cancel(
        order.id,
        { id: adminId, role: UserRole.ADMIN },
        { acknowledgeRefund: true },
      );

      const note = await prisma.notification.findFirstOrThrow({
        where: {
          userId: customerId,
          type: 'order.status_changed',
          title: { contains: order.orderNumber },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(note.body).toMatch(/refund will be processed manually/i);
    });

    it('advance and deliver each notify the customer by name', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await orders.advance(order.id, adminId);
      await orders.deliver(order.id, adminId);

      const notes = await prisma.notification.findMany({
        where: {
          userId: customerId,
          type: 'order.status_changed',
          title: { contains: order.orderNumber },
        },
        orderBy: { createdAt: 'asc' },
      });
      const titles = notes.map((n) => n.title);
      expect(titles.some((t) => t.includes('confirmed'))).toBe(true);
      expect(titles.some((t) => t.includes('ready'))).toBe(true);
      expect(titles.some((t) => t.includes('delivered'))).toBe(true);
    });

    /**
     * The plan's own acceptance criterion, as a test: "place COD order →
     * confirm → produce → QC → deliver, all visible from the customer account
     * within one take." A customer only SEES what a notification tells them to
     * go look at — so "visible" means notified, at every step, not just the
     * ones an admin's click happened to cause.
     *
     * This is the test that caught a real gap: production.service.ts's
     * syncOrderStatus drives THREE of these five transitions
     * (IN_PRODUCTION, QUALITY_CHECK, COMPLETED) and, before this test forced the
     * fix, notified nobody for any of them. A customer who ordered a uniform
     * heard "confirmed" and then silence until an admin remembered to click
     * "Deliver" — no "it's being cut", no "it's being inspected", no "it's
     * ready". The order_status_history rows were always correct (the stepper
     * would have shown the right steps if the customer thought to open the
     * page); the notification that tells them to open it was simply never sent.
     */
    it('notifies at EVERY step of the full demo path — including the three the production floor drives', async () => {
      const order = await placeUniformOrder();
      await orders.confirmOrder(order.id, adminId);

      const production = app.get(ProductionService);
      const [task] = await prisma.productionTask.findMany({
        where: { orderId: order.id },
      });
      const workerUser = await prisma.user.create({
        data: {
          email: `${TAG}-demo-worker@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Demo',
          lastName: 'Worker',
          role: UserRole.WORKER,
        },
      });
      const worker = await prisma.worker.create({
        data: { userId: workerUser.id },
      });
      await production.assign(task.id, worker.id);

      // CUTTING -> STITCHING -> FINISHING -> QUALITY_CHECK -> pass.
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'complete', adminId, UserRole.ADMIN);
      await production.act(task.id, 'advance', adminId, UserRole.ADMIN); // -> STITCHING
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'complete', adminId, UserRole.ADMIN);
      await production.act(task.id, 'advance', adminId, UserRole.ADMIN); // -> FINISHING
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'complete', adminId, UserRole.ADMIN);
      await production.act(task.id, 'advance', adminId, UserRole.ADMIN); // -> QUALITY_CHECK
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'qc_pass', adminId, UserRole.ADMIN); // order -> COMPLETED

      const afterQc = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(afterQc.status).toBe(OrderStatus.COMPLETED);

      await orders.deliver(order.id, adminId);

      const notes = await prisma.notification.findMany({
        where: {
          userId: customerId,
          type: 'order.status_changed',
          title: { contains: order.orderNumber },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Order matters here, not just presence — this IS the tracking timeline.
      expect(notes.map((n) => n.title)).toEqual([
        `Order ${order.orderNumber} confirmed`,
        `Order ${order.orderNumber} is in production`,
        `Order ${order.orderNumber} is being inspected`,
        `Order ${order.orderNumber} is ready`,
        `Order ${order.orderNumber} delivered`,
      ]);

      // Cleanup this test's own worker so the outer afterAll's product/user
      // deletes are not blocked by a dangling assignment.
      await prisma.productionTask.updateMany({
        where: { orderId: order.id },
        data: { assignedWorkerId: null },
      });
      await prisma.worker.delete({ where: { id: worker.id } });
      await prisma.user.delete({ where: { id: workerUser.id } });
    });
  });

  // ═══ "Confirm" / "mark cash collected" — the payment action's note ═══════
  //
  // Both buttons are payments.service.ts's markPaymentPaid under two labels
  // (see AdminOrderAction's docblock). It records `note` in TWO different
  // places because the two cases have no single shared home for it: on the
  // bank-pending edge the order is still PENDING, so confirmOrder's own
  // history write happens and the note rides along; on the "mark collected"
  // edge the order is already CONFIRMED (or further), so confirmOrder is an
  // idempotent no-op that writes NO history row — without the AuditLog write,
  // that note would be accepted by the API and then silently vanish.

  describe('markPaymentPaid note — recorded wherever confirmOrder does and does not write', () => {
    it('bank-pending edge: the note lands on the CONFIRMED history row', async () => {
      const order = await placeRetailOrder();
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.PENDING,
          method: PaymentMethod.PAYHERE, // a bank/manual-style method, not COD
        },
      });

      const payments = app.get(PaymentsService);
      await payments.markPaymentPaid(
        order.id,
        adminId,
        'Bank slip verified by phone',
      );

      const confirmed = await prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId: order.id, toStatus: OrderStatus.CONFIRMED },
      });
      expect(confirmed.note).toBe('Bank slip verified by phone');
    });

    it('mark-collected edge: confirmOrder no-ops (no new history row), but the note still lands in the audit log', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId); // already CONFIRMED before payment exists
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.PENDING,
          method: PaymentMethod.COD,
        },
      });

      const historyBefore = await prisma.orderStatusHistory.count({
        where: { orderId: order.id },
      });

      const payments = app.get(PaymentsService);
      await payments.markPaymentPaid(
        order.id,
        adminId,
        'Collected by courier, LKR 2000 cash',
      );

      // confirmOrder's own no-op path: the note has nowhere to attach on the
      // ORDER because the order did not change — proving this is the exact
      // gap the audit-log write exists to close, not a redundant belt-and-braces.
      const historyAfter = await prisma.orderStatusHistory.count({
        where: { orderId: order.id },
      });
      expect(historyAfter).toBe(historyBefore);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'payment.mark_paid', entityId: payment.id },
      });
      expect((log.after as { note?: string }).note).toBe(
        'Collected by courier, LKR 2000 cash',
      );
    });
  });

  // ═══ The admin action list — single source, wired to real rows ═══════════

  describe('adminActions — the server decides what the buttons say and why', () => {
    it('offers only confirm on a fresh PENDING order, with reasons on the rest', async () => {
      const order = await placeRetailOrder();
      const seen = await orders.findById(order.id, { isAdmin: true });

      const byAction = Object.fromEntries(
        seen.adminActions!.map((a) => [a.action, a]),
      );
      expect(byAction.confirm.allowed).toBe(true);
      expect(byAction.cancel.allowed).toBe(true); // PENDING is cancellable too
      expect(byAction.advance.allowed).toBe(false);
      expect(byAction.deliver.allowed).toBe(false);
      expect(byAction.deliver.reason).toBeTruthy();
    });

    it('offers mark_collected only for an uncollected COD order', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.PENDING,
          method: PaymentMethod.COD,
        },
      });

      const seen = await orders.findById(order.id, { isAdmin: true });
      const markCollected = seen.adminActions!.find(
        (a) => a.action === 'mark_collected',
      )!;
      expect(markCollected.allowed).toBe(true);

      // Once collected, the button withdraws itself.
      await prisma.payment.update({
        where: { orderId: order.id },
        data: { status: PaymentStatus.COMPLETED },
      });
      const after = await orders.findById(order.id, { isAdmin: true });
      expect(
        after.adminActions!.find((a) => a.action === 'mark_collected')!.allowed,
      ).toBe(false);
    });

    it('never attaches adminActions to a customer-facing read', async () => {
      const order = await placeRetailOrder();
      const seenByCustomer = await orders.findById(order.id, {
        userId: customerId,
      });
      expect(
        (seenByCustomer as { adminActions?: unknown }).adminActions,
      ).toBeUndefined();
    });

    it('resolves who changed each status to a name — for admins only', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);

      const seenByAdmin = await orders.findById(order.id, { isAdmin: true });
      const history = seenByAdmin.statusHistory as unknown as Array<{
        toStatus: string;
        changedByName?: string;
        changedBy: string | null;
      }>;

      const opening = history.find((h) => h.toStatus === 'PENDING')!;
      const confirmed = history.find((h) => h.toStatus === 'CONFIRMED')!;
      // The order's own creation has no human actor — it is the system opening
      // the record, not an admin clicking a button.
      expect(opening.changedByName).toBe('System');
      expect(confirmed.changedByName).toBe('Ada Admin');

      // A customer reading their own order gets the SAME rows, minus the name —
      // resolving it costs a query that exists solely for a screen they cannot see.
      const seenByCustomer = await orders.findById(order.id, {
        userId: customerId,
      });
      const customerHistory = seenByCustomer.statusHistory as unknown as Array<{
        changedByName?: string;
      }>;
      expect(customerHistory.every((h) => h.changedByName === undefined)).toBe(
        true,
      );
    });
  });

  // ═══ Admin order list — filters ════════════════════════════════════════════

  describe('findAllOrders — filters', () => {
    it('filters by order status', async () => {
      const order = await placeRetailOrder();
      const { orders: results } = await orders.findAllOrders({
        status: OrderStatus.PENDING,
        search: order.orderNumber,
      });
      expect(results.map((o) => o.id)).toContain(order.id);
    });

    it('searches by order number', async () => {
      const order = await placeRetailOrder();
      const { orders: results } = await orders.findAllOrders({
        search: order.orderNumber,
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(order.id);
    });

    it('filters by payment method', async () => {
      const order = await placeRetailOrder();
      await orders.confirmOrder(order.id, adminId);
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: 2000,
          currency: 'LKR',
          status: PaymentStatus.PENDING,
          method: PaymentMethod.COD,
        },
      });

      const { orders: cod } = await orders.findAllOrders({
        method: PaymentMethod.COD,
        search: order.orderNumber,
      });
      expect(cod.map((o) => o.id)).toContain(order.id);

      const { orders: payhere } = await orders.findAllOrders({
        method: PaymentMethod.PAYHERE,
        search: order.orderNumber,
      });
      expect(payhere.map((o) => o.id)).not.toContain(order.id);
    });
  });
});
