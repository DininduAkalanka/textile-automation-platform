import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MovementType,
  OrderStatus,
  PaymentMethod,
  PaymentPlan,
  PaymentStatus,
  Prisma,
  ProductType,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Installments E2E Suite (QA-2.4a, QA-2.4b, QA-2.4c).
 *
 * Covers:
 * - QA-2.4a: Reconciliation invariant — sum of all installment amounts strictly equals order total.
 * - QA-2.4b: Concurrency race — simultaneous webhooks for the same installment cannot double-credit.
 * - QA-2.4c: Cancel gap closure — cancelling an order with 1 of N installments paid voids remaining
 *            scheduled installments to FAILED and enforces refund acknowledgment.
 */
describe('Installments Invariants & Lifecycle (QA-2.4a - QA-2.4c)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let payments: PaymentsService;

  const TAG = `inst-${Date.now()}`;
  let customerId: string;
  let adminId: string;
  let productId: string;

  const address = {
    fullName: 'Installment Tester',
    addressLine1: '100 Galle Rd',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00300',
    country: 'LK',
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
    payments = app.get(PaymentsService);

    // Create test customer and admin
    customerId = (
      await prisma.user.create({
        data: {
          email: `${TAG}-customer@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Installment',
          lastName: 'Customer',
          role: UserRole.CUSTOMER,
        },
      })
    ).id;

    adminId = (
      await prisma.user.create({
        data: {
          email: `${TAG}-admin@example.test`,
          passwordHash: 'x',
          emailVerified: true,
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
        },
      })
    ).id;

    // Seed product with inventory
    const product = await prisma.product.create({
      data: {
        name: `Installment Product ${TAG}`,
        slug: `${TAG}-product`,
        sku: `${TAG}-sku`,
        price: 3333.33,
        stockQuantity: 100,
        productType: ProductType.READY_MADE,
        requiresMeasurement: false,
      },
    });
    productId = product.id;

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: 100,
        quantityReserved: 0,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: MovementType.INITIAL,
        quantityChange: 100,
      },
    });
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.installment.deleteMany({
      where: { payment: { order: { userId: customerId } } },
    });
    await prisma.payment.deleteMany({
      where: { order: { userId: customerId } },
    });
    await prisma.order.deleteMany({
      where: { userId: customerId },
    });
    await prisma.product.deleteMany({
      where: { sku: { startsWith: TAG } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, adminId] } },
    });
    await app.close();
  });

  /**
   * QA-2.4a: Reconciliation-style invariant test.
   * Asserts sum of all Installment rows strictly equals the order total across
   * varying total amounts and installment counts (2, 3, 4, 6 installments).
   */
  describe('[QA-2.4a] Installment reconciliation invariant', () => {
    it('sum of all installment amounts exactly matches order total with zero drift', async () => {
      const testCases = [
        { count: 2 },
        { count: 3 },
        { count: 4 },
        { count: 6 },
      ];

      for (const { count } of testCases) {
        const order = await orders.create(customerId, {
          items: [{ productId, quantity: 1 }],
          shippingAddress: address,
        });

        const installmentResult = await payments.createInstallmentPayment(
          order.id,
          customerId,
          count,
        );

        expect(installmentResult.installments).toHaveLength(count);

        // Query database rows directly
        const dbInstallments = await prisma.installment.findMany({
          where: { payment: { orderId: order.id } },
          orderBy: { installmentNo: 'asc' },
        });

        expect(dbInstallments).toHaveLength(count);

        // Sum decimal values
        const totalSum = dbInstallments.reduce(
          (acc, inst) => acc.add(inst.amount),
          new Prisma.Decimal(0),
        );

        // Invariant: sum(installments.amount) == order.total
        expect(Number(totalSum)).toBeCloseTo(Number(order.total), 2);
        expect(totalSum.toFixed(2)).toBe(order.total.toFixed(2));
      }
    });
  });

  /**
   * QA-2.4b: Concurrency race test.
   * Two installment payment webhooks / confirmations for the same installment
   * fire simultaneously (Promise.all) — asserts no double-credit or invalid state.
   */
  describe('[QA-2.4b] Simultaneous installment confirmation race', () => {
    it('handles concurrent confirmations for the same installment idempotently without double-credit', async () => {
      const order = await orders.create(customerId, {
        items: [{ productId, quantity: 1 }],
        shippingAddress: address,
      });

      const { installments } = await payments.createInstallmentPayment(
        order.id,
        customerId,
        3,
      );

      const targetInstallment = installments[0];

      // Fire 2 confirmations concurrently
      const [res1, res2] = await Promise.all([
        payments.confirmInstallment(targetInstallment.id),
        payments.confirmInstallment(targetInstallment.id),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // Verify row state in database
      const verified = await prisma.installment.findUniqueOrThrow({
        where: { id: targetInstallment.id },
      });

      expect(verified.status).toBe(PaymentStatus.COMPLETED);
      expect(verified.paidAt).not.toBeNull();

      // Ensure remaining installments were NOT prematurely marked paid
      const otherInstallments = await prisma.installment.findMany({
        where: {
          payment: { orderId: order.id },
          id: { not: targetInstallment.id },
        },
      });

      expect(otherInstallments).toHaveLength(2);
      expect(
        otherInstallments.every((i) => i.status === PaymentStatus.PENDING),
      ).toBe(true);

      // Ensure overall payment remains PENDING (not COMPLETED until all are paid)
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { orderId: order.id },
      });
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });
  });

  /**
   * QA-2.4c: Order cancelled after 1 of N installments paid.
   * Asserts:
   * 1. Attempting to cancel without acknowledging refund is rejected.
   * 2. Remaining scheduled installments are voided (marked FAILED), not left pending.
   * 3. Overall payment is marked REFUNDED.
   * 4. Notification reflects manual refund obligation.
   */
  describe('[QA-2.4c] Order cancelled after partial installment payment', () => {
    it('voids remaining installments and requires refund acknowledgment on cancel', async () => {
      const order = await orders.create(customerId, {
        items: [{ productId, quantity: 1 }],
        shippingAddress: address,
      });

      // 1. Create 3-installment schedule
      const { installments } = await payments.createInstallmentPayment(
        order.id,
        customerId,
        3,
      );

      // 2. Pay installment 1 (this also confirms the order)
      await payments.confirmPayment(order.id);

      const afterFirstPay = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payment: { include: { installments: true } } },
      });
      expect(afterFirstPay.status).toBe(OrderStatus.CONFIRMED);
      expect(afterFirstPay.payment?.status).toBe(PaymentStatus.PENDING);

      const paidInst = afterFirstPay.payment!.installments.find(
        (i) => i.installmentNo === 1,
      );
      expect(paidInst?.status).toBe(PaymentStatus.COMPLETED);

      // 3. Admin attempts to cancel WITHOUT acknowledging refund -> must throw BadRequestException
      await expect(
        orders.cancel(
          order.id,
          { id: adminId, role: UserRole.ADMIN },
          { acknowledgeRefund: false },
        ),
      ).rejects.toThrow(BadRequestException);

      // 4. Admin cancels WITH refund acknowledgment
      await orders.cancel(
        order.id,
        { id: adminId, role: UserRole.ADMIN },
        { acknowledgeRefund: true, note: 'Customer requested plan termination' },
      );

      // 5. Assert order status is CANCELLED
      const cancelledOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payment: { include: { installments: true } } },
      });
      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);

      // 6. Assert remaining installments (No. 2 and No. 3) are marked FAILED (voided)
      const remainingInstallments =
        cancelledOrder.payment!.installments.filter(
          (i) => i.installmentNo !== 1,
        );
      expect(remainingInstallments).toHaveLength(2);
      expect(
        remainingInstallments.every((i) => i.status === PaymentStatus.FAILED),
      ).toBe(true);

      // 7. Assert paid installment remains COMPLETED (audit record of money collected)
      const auditPaidInst = cancelledOrder.payment!.installments.find(
        (i) => i.installmentNo === 1,
      );
      expect(auditPaidInst?.status).toBe(PaymentStatus.COMPLETED);

      // 8. Assert overall payment is marked REFUNDED
      expect(cancelledOrder.payment?.status).toBe(PaymentStatus.REFUNDED);

      // 9. Assert customer notification carries manual refund note
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
  });
});
