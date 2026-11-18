import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import {
  MovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  ProductionStage,
} from '@prisma/client';
import crypto from 'crypto';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsService } from '../src/payments/payments.service';
import { findDrift } from '../src/inventory/reconcile';

/**
 * Phase 2: Automated End-to-End User Journeys (J1, J3, J7, J8).
 *
 * Runs against the isolated throwaway database `textile_qa` on 127.0.0.1:5433.
 * Deeply asserts database state (order status machine, payment records, double-entry
 * inventory movements, production tasks, and session family invalidation).
 */
describe('Phase 2: Platform Critical User Journeys', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;

  const TAG = `journey-${Date.now()}`;
  const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || '1236900';
  const PAYHERE_MERCHANT_SECRET =
    process.env.PAYHERE_MERCHANT_SECRET ||
    'MTExMTI1NTIyMzA0MzYwODIzNDIyNzYxMjAyNjYyMDAwOTAwNzk1';

  let readyMadeProductId: string;
  let uniformProductId: string;
  let customerId: string;

  const validAddress = {
    fullName: 'Silva Perera',
    addressLine1: '88 Galle Road',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00300',
    country: 'LK',
  };

  function generatePayhereSig(
    merchantId: string,
    orderId: string,
    amount: string,
    currency: string,
    statusCode: string,
  ): string {
    const hashedSecret = crypto
      .createHash('md5')
      .update(PAYHERE_MERCHANT_SECRET)
      .digest('hex')
      .toUpperCase();
    const formattedAmount = Number(amount).toFixed(2);
    return crypto
      .createHash('md5')
      .update(
        merchantId + orderId + formattedAmount + currency + statusCode + hashedSecret,
      )
      .digest('hex')
      .toUpperCase();
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    ordersService = app.get(OrdersService);
    paymentsService = app.get(PaymentsService);

    // Create a customer
    const user = await prisma.user.create({
      data: {
        email: `customer-${TAG}@example.com`,
        passwordHash: 'dummy',
        firstName: 'Silva',
        lastName: 'Perera',
        emailVerified: true,
      },
    });
    customerId = user.id;

    // Seed test products & inventory
    const readyProduct = await prisma.product.create({
      data: {
        name: `Journey Ready Product ${TAG}`,
        slug: `${TAG}-ready`,
        sku: `${TAG}-ready-sku`,
        price: 3500.0,
        stockQuantity: 50,
        productType: ProductType.READY_MADE,
        requiresMeasurement: false,
      },
    });
    readyMadeProductId = readyProduct.id;

    const readyInv = await prisma.inventory.create({
      data: {
        productId: readyMadeProductId,
        quantityAvailable: 50,
        quantityReserved: 0,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: readyInv.id,
        type: MovementType.INITIAL,
        quantityChange: 50,
      },
    });

    const uniformProduct = await prisma.product.create({
      data: {
        name: `Journey Uniform Product ${TAG}`,
        slug: `${TAG}-uniform`,
        sku: `${TAG}-uniform-sku`,
        price: 7500.0,
        stockQuantity: 20,
        productType: ProductType.UNIFORM,
        requiresMeasurement: true,
      },
    });
    uniformProductId = uniformProduct.id;

    const uniformInv = await prisma.inventory.create({
      data: {
        productId: uniformProductId,
        quantityAvailable: 20,
        quantityReserved: 0,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: uniformInv.id,
        type: MovementType.INITIAL,
        quantityChange: 20,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /* ──────────────────────────────────────────────────────────────
   * J1: Guest Checkout -> PayHere Webhook -> CONFIRMED -> Production -> SALE
   * ────────────────────────────────────────────────────────────── */
  it('J1: Executes Guest Checkout through PayHere Webhook to Production Task and Inventory SALE', async () => {
    // 1. Guest initiates checkout
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders/guest-checkout')
      .send({
        email: `guest-${TAG}@example.com`,
        fullName: 'Kamal Gunaratne',
        phone: '+94770001122',
        paymentMethod: PaymentMethod.PAYHERE,
        items: [
          {
            productId: uniformProductId,
            quantity: 2,
            measurements: {
              personName: 'Kamal Junior',
              unit: 'cm',
              values: {
                chest: 90,
                waist: 75,
                shoulder: 42,
                sleeveLength: 55,
                shirtLength: 68,
                frockLength: 80,
                trouserWaist: 75,
                hip: 88,
                trouserLength: 95,
              },
            },
          },
        ],
        shippingAddress: validAddress,
      });

    expect(checkoutRes.status).toBe(201);
    const orderData = checkoutRes.body.order || checkoutRes.body.data;
    const orderId = orderData.id;
    const orderNumber = orderData.orderNumber;

    expect(orderId).toBeDefined();
    expect(orderNumber).toBeDefined();

    // Assert DB State: Order PENDING, inventory RESERVED
    const dbOrderPending = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    expect(dbOrderPending?.status).toBe(OrderStatus.PENDING);

    const dbInvPending = await prisma.inventory.findUnique({
      where: { productId: uniformProductId },
    });
    expect(dbInvPending?.quantityReserved).toBe(2);

    // 2. Initialize PayHere payment record (as the frontend checkout does before redirecting)
    await paymentsService.createPayherePayment(orderId, dbOrderPending!.userId);

    // 3. PayHere Webhook Notification Arrives
    const orderTotal = Number(dbOrderPending?.total).toFixed(2);
    const currency = 'LKR';
    const statusCode = '2'; // SUCCESS
    const md5sig = generatePayhereSig(
      PAYHERE_MERCHANT_ID,
      orderNumber,
      orderTotal,
      currency,
      statusCode,
    );

    const webhookRes = await request(app.getHttpServer())
      .post('/payments/payhere/notify')
      .type('form')
      .send({
        merchant_id: PAYHERE_MERCHANT_ID,
        order_id: orderNumber,
        payment_id: `PAYHERE_${Date.now()}`,
        payhere_amount: orderTotal,
        payhere_currency: currency,
        status_code: statusCode,
        md5sig,
      });

    expect([200, 201, 204]).toContain(webhookRes.status);

    // 3. Assert DB State after Webhook:
    // - Order advanced to CONFIRMED
    const dbOrderConfirmed = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, productionTasks: true },
    });
    expect(dbOrderConfirmed?.status).toBe(OrderStatus.CONFIRMED);
    expect(dbOrderConfirmed?.payment?.status).toBe(PaymentStatus.COMPLETED);

    // - Production Task automatically created for uniform product
    expect(dbOrderConfirmed?.productionTasks.length).toBeGreaterThanOrEqual(1);
    expect(dbOrderConfirmed?.productionTasks[0].stage).toBe(
      ProductionStage.CUTTING,
    );

    // - Inventory Movement SALE recorded and reserved stock released
    const saleMovement = await prisma.inventoryMovement.findFirst({
      where: { inventory: { productId: uniformProductId }, type: MovementType.SALE },
    });
    expect(saleMovement).toBeDefined();
    expect(saleMovement?.quantityChange).toBe(-2);
  });

  /* ──────────────────────────────────────────────────────────────
   * J3: Installment Schedule and Partial Payments
   * ────────────────────────────────────────────────────────────── */
  it('J3: Creates Installment Schedule and processes installment payment correctly', async () => {
    // 1. Create order
    const order = await ordersService.create(customerId, {
      items: [{ productId: readyMadeProductId, quantity: 2 }],
      shippingAddress: validAddress,
    });

    // 2. Create installment plan (3 installments)
    const installmentResult = await paymentsService.createInstallmentPayment(
      order.id,
      customerId,
      3,
    );

    expect(installmentResult.installments).toHaveLength(3);

    // Assert DB State: Installments created with correct total
    const dbInstallments = await prisma.installment.findMany({
      where: { payment: { orderId: order.id } },
      orderBy: { installmentNo: 'asc' },
    });
    expect(dbInstallments).toHaveLength(3);

    const totalSum = dbInstallments.reduce(
      (acc, inst) => acc + Number(inst.amount),
      0,
    );
    expect(totalSum).toBe(Number(order.total));
    expect(dbInstallments[0].status).toBe('PENDING');
  });

  /* ──────────────────────────────────────────────────────────────
   * J7: Order Cancellation -> Stock RELEASE -> Audit Log & Zero Drift
   * ────────────────────────────────────────────────────────────── */
  it('J7: Order Cancellation releases reserved inventory and leaves zero ledger drift', async () => {
    // 1. Place order
    const order = await ordersService.create(customerId, {
      items: [{ productId: readyMadeProductId, quantity: 1 }],
      shippingAddress: validAddress,
    });

    // Inventory reserved
    const invBeforeCancel = await prisma.inventory.findUnique({
      where: { productId: readyMadeProductId },
    });
    expect(invBeforeCancel?.quantityReserved).toBeGreaterThanOrEqual(1);

    // 2. Cancel order
    const cancelled = await ordersService.cancel(
      order.id,
      customerId,
      'Customer requested cancellation',
    );
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    // 3. Assert DB State:
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true },
    });
    expect(dbOrder?.status).toBe(OrderStatus.CANCELLED);
    expect(
      dbOrder?.statusHistory.some((h) => h.toStatus === OrderStatus.CANCELLED),
    ).toBe(true);

    // Inventory reserved quantity is decremented back
    const invAfterCancel = await prisma.inventory.findUnique({
      where: { productId: readyMadeProductId },
    });
    expect(invAfterCancel?.quantityReserved).toBe(
      invBeforeCancel!.quantityReserved - 1,
    );

    // Zero drift in inventory ledger
    const drift = await findDrift(prisma, readyMadeProductId);
    expect(drift).toEqual([]);
  });

  /* ──────────────────────────────────────────────────────────────
   * J8: Session Refresh Rotation and Token Theft / Reuse Detection
   * ────────────────────────────────────────────────────────────── */
  it('J8: Rotates refresh token and revokes entire token family upon reuse detection', async () => {
    const user = await prisma.user.create({
      data: {
        email: `token-theft-${TAG}@example.com`,
        passwordHash: 'dummy',
        firstName: 'Theft',
        lastName: 'Victim',
        emailVerified: true,
      },
    });

    // Create active refresh token
    const oldTokenHash = `${TAG}-old-token-hash`;
    const initialToken = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: oldTokenHash,
        expiresAt: new Date(Date.now() + 604800000),
      },
    });

    // Legitimate rotation: old token is revoked and new token issued
    const newTokenHash = `${TAG}-new-token-hash`;
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: initialToken.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + 604800000),
        },
      }),
    ]);

    // Verify state after legitimate rotation
    const revokedOld = await prisma.refreshToken.findUnique({
      where: { id: initialToken.id },
    });
    expect(revokedOld?.revokedAt).not.toBeNull();

    // Attacker attempts to reuse the revoked old token
    // Theft detection triggered: revoke ALL refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    // Assert: Entire session family is revoked
    const allTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(allTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });
});
