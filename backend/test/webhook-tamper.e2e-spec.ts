import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import {
  MovementType,
  OrderStatus,
  PaymentMethod,
  PaymentPlan,
  PaymentStatus,
  ProductType,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { payhereNotifySig } from '../src/payments/payhere.util';

/**
 * Webhook Tamper & Replay Suite (QA-webhook-tamper).
 *
 * Verifies that the payment webhook endpoint (/payments/payhere/notify)
 * defends against replay and parameter-tampering attacks:
 * 1. Stale signature for modified data (amount altered while reusing old valid signature).
 * 2. Stale signature replayed against a different order ID.
 * 3. Validly signed underpayment (amount mismatch) leaves order unconfirmed.
 */
describe('Payment Webhook Tamper Guard E2E (QA-webhook-tamper)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let config: ConfigService;

  const TAG = `tamper-${Date.now()}`;
  let customerId: string;
  let productId: string;
  let merchantId: string;
  let merchantSecret: string;

  const address = {
    fullName: 'Tamper Tester',
    addressLine1: '88 Cyber Way',
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
    orders = app.get(OrdersService);
    config = app.get(ConfigService);

    merchantId = config.get<string>('PAYHERE_MERCHANT_ID') || 'test-merchant-id';
    merchantSecret =
      config.get<string>('PAYHERE_MERCHANT_SECRET') || 'test-merchant-secret';

    const customer = await prisma.user.create({
      data: {
        email: `${TAG}-buyer@example.test`,
        passwordHash: 'x',
        emailVerified: true,
        firstName: 'Tamper',
        lastName: 'Target',
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;

    const product = await prisma.product.create({
      data: {
        name: `Tamper Target Product ${TAG}`,
        slug: `${TAG}-product`,
        sku: `${TAG}-sku`,
        price: 5000,
        stockQuantity: 50,
        productType: ProductType.READY_MADE,
        requiresMeasurement: false,
      },
    });
    productId = product.id;

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: 50,
        quantityReserved: 0,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: MovementType.INITIAL,
        quantityChange: 50,
      },
    });
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.paymentWebhookEvent.deleteMany({
      where: { gateway: 'payhere' },
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
      where: { id: customerId },
    });
    await app.close();
  });

  async function createTestOrder() {
    const order = await orders.create(customerId, {
      items: [{ productId, quantity: 1 }],
      shippingAddress: address,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        currency: 'LKR',
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYHERE,
        paymentPlan: PaymentPlan.FULL,
      },
    });

    return prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
  }

  it('rejects webhook with stale signature when payload amount is modified', async () => {
    const order = await createTestOrder();
    const transactionId = `txn-stale-amt-${Date.now()}`;

    // Attacker obtains a valid signature for 100.00
    const staleSignatureFor100 = payhereNotifySig({
      merchantId,
      orderId: order.orderNumber,
      payhereAmount: '100.00',
      payhereCurrency: 'LKR',
      statusCode: '2',
      merchantSecret,
    });

    // Attacker modifies amount in payload to full 5000.00 while reusing stale signature
    const tamperedPayload = {
      merchant_id: merchantId,
      order_id: order.orderNumber,
      payment_id: transactionId,
      payhere_amount: '5000.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: staleSignatureFor100,
    };

    const res = await request(app.getHttpServer())
      .post('/payments/payhere/notify')
      .send(tamperedPayload);

    expect(res.status).toBe(201); // Server-to-server webhook returns 200/201 acknowledgment

    // Verify audit log captured invalid signature
    const webhookEvent = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { transactionId },
    });
    expect(webhookEvent.signatureValid).toBe(false);
    expect(webhookEvent.processingError).toBe('INVALID_SIGNATURE');

    // CRITICAL: Order and Payment remain PENDING — stock is not confirmed
    const unconfirmedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(unconfirmedOrder.status).toBe(OrderStatus.PENDING);
    expect(unconfirmedOrder.payment?.status).toBe(PaymentStatus.PENDING);
  });

  it('rejects webhook with signature replayed against a different order number', async () => {
    const orderA = await createTestOrder();
    const orderB = await createTestOrder();
    const transactionId = `txn-replay-order-${Date.now()}`;

    // Valid signature for Order A
    const sigForOrderA = payhereNotifySig({
      merchantId,
      orderId: orderA.orderNumber,
      payhereAmount: '5000.00',
      payhereCurrency: 'LKR',
      statusCode: '2',
      merchantSecret,
    });

    // Replay signature against Order B
    const replayedPayload = {
      merchant_id: merchantId,
      order_id: orderB.orderNumber,
      payment_id: transactionId,
      payhere_amount: '5000.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: sigForOrderA,
    };

    await request(app.getHttpServer())
      .post('/payments/payhere/notify')
      .send(replayedPayload);

    // Verify audit log
    const webhookEvent = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { transactionId },
    });
    expect(webhookEvent.signatureValid).toBe(false);
    expect(webhookEvent.processingError).toBe('INVALID_SIGNATURE');

    // Order B remains PENDING
    const unconfirmedOrderB = await prisma.order.findUniqueOrThrow({
      where: { id: orderB.id },
    });
    expect(unconfirmedOrderB.status).toBe(OrderStatus.PENDING);
  });

  it('detects underpayment amount mismatch and refuses to confirm order', async () => {
    const order = await createTestOrder();
    const transactionId = `txn-underpay-${Date.now()}`;

    // Valid signature for an underpaid amount (e.g. 50.00 instead of 5000.00)
    const validUnderpaySig = payhereNotifySig({
      merchantId,
      orderId: order.orderNumber,
      payhereAmount: '50.00',
      payhereCurrency: 'LKR',
      statusCode: '2',
      merchantSecret,
    });

    const underpayPayload = {
      merchant_id: merchantId,
      order_id: order.orderNumber,
      payment_id: transactionId,
      payhere_amount: '50.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: validUnderpaySig,
    };

    await request(app.getHttpServer())
      .post('/payments/payhere/notify')
      .send(underpayPayload);

    // Signature was mathematically valid, but amount was mismatched
    const webhookEvent = await prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { transactionId },
    });
    expect(webhookEvent.signatureValid).toBe(true);
    expect(webhookEvent.processingError).toBe('AMOUNT_MISMATCH');

    // Order must NOT be confirmed
    const orderAfter = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(orderAfter.status).toBe(OrderStatus.PENDING);
    expect(orderAfter.payment?.status).toBe(PaymentStatus.PENDING);
  });
});
