import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { Express } from 'express';
import {
  MovementType,
  OrderStatus,
  PaymentStatus,
  ProductType,
  ProductionStage,
  UserRole,
  VerificationChannel,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { OrderExpiryService } from '../src/orders/order-expiry.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { EmailService } from '../src/email/email.service';
import { payhereNotifySig } from '../src/payments/payhere.util';
import { trustProxyHops } from '../src/common/config/limits';

/**
 * QA remediation regression suite (independent QA report, 2026-11-19).
 *
 * One block per P0/P1 finding. Every attack the report reproduced live is
 * replayed here against a real Postgres through the real HTTP stack (global
 * validation pipe, the production error envelope and response envelope), and
 * each test asserts the FIXED behaviour. Each of these bugs had passed the
 * previous 390 green tests, which is why the attacks are reproduced literally.
 *
 * The test app trusts X-Forwarded-For so each test can choose its own client
 * address (separate per-IP throttle buckets and per-IP caps). Production does
 * NOT do this — see the P1-4 block for the real trust-proxy rule.
 */
describe('QA remediation — P0/P1 regression suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let merchantId: string;
  let merchantSecret: string;

  const TAG = `qafix-${Date.now()}`;
  const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
  let counter = 0;
  const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
  const phoneSeed = Number(String(Date.now()).slice(-7));
  const phone = () =>
    `+9477${String((phoneSeed + counter++ * 7919) % 10_000_000).padStart(7, '0')}`;
  let ipCounter = 1;
  const ip = () => {
    const n = ipCounter++;
    return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  };

  const address = {
    fullName: 'QA Buyer',
    addressLine1: '12 Galle Road',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00300',
    country: 'Sri Lanka',
  };
  const measurements = {
    personName: 'QA Child',
    values: {
      chest: 76,
      waist: 66,
      shoulder: 36,
      sleeveLength: 46,
      shirtLength: 60,
      trouserWaist: 66,
      hip: 80,
      trouserLength: 90,
    },
  };

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => res.body.data;
  const errCode = (res: request.Response) => res.body.error?.code;
  const refreshCookie = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refresh_token='));

  async function seedProduct(
    label: string,
    opts: {
      stock?: number;
      price?: number;
      productType?: ProductType;
      requiresMeasurement?: boolean;
      attributes?: Record<string, unknown>;
    } = {},
  ) {
    const stock = opts.stock ?? 100;
    const product = await prisma.product.create({
      data: {
        name: `QA ${label} ${TAG}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: opts.price ?? 1000,
        stockQuantity: stock,
        productType: opts.productType ?? ProductType.READY_MADE,
        requiresMeasurement: opts.requiresMeasurement ?? false,
        attributes: opts.attributes ?? {},
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

  async function seedUser(
    label: string,
    opts: {
      role?: UserRole;
      password?: string;
      cost?: number;
      emailVerified?: boolean;
    } = {},
  ) {
    const password = opts.password ?? 'Correct#Pass1';
    return prisma.user.create({
      data: {
        email: `${TAG}-${label}@example.test`,
        phone: phone(),
        passwordHash: await bcrypt.hash(password, opts.cost ?? 4),
        firstName: label,
        lastName: 'Tester',
        role: opts.role ?? UserRole.CUSTOMER,
        emailVerified: opts.emailVerified ?? true,
      },
    });
  }

  async function login(identifier: string, password = 'Correct#Pass1') {
    const res = await http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip())
      .send({ identifier, password });
    expect(res.status).toBe(201);
    return { token: data(res).accessToken as string, res };
  }

  function signedNotify(p: {
    orderRef: string;
    paymentId: string;
    amount: string;
    status?: string;
  }) {
    const status = p.status ?? '2';
    return {
      merchant_id: merchantId,
      order_id: p.orderRef,
      payment_id: p.paymentId,
      payhere_amount: p.amount,
      payhere_currency: 'LKR',
      status_code: status,
      md5sig: payhereNotifySig({
        merchantId,
        orderId: p.orderRef,
        payhereAmount: p.amount,
        payhereCurrency: 'LKR',
        statusCode: status,
        merchantSecret,
      }),
    };
  }

  const guestBody = (over: Record<string, unknown> = {}) => ({
    items: [{ productId: retailId, quantity: 1 }],
    shippingAddress: address,
    email: `${TAG}-guest-${uniq()}@example.test`,
    phone: phone(),
    fullName: 'Guest Buyer',
    paymentMethod: 'PAYHERE',
    ...over,
  });

  const revenueWindow = () => ({
    from: new Date(Date.now() - 24 * 3600_000),
    to: new Date(Date.now() + 24 * 3600_000),
  });
  const revenueNow = async () =>
    Number(
      (
        await app
          .get(AnalyticsService, { strict: false })
          .getTotals(revenueWindow())
      ).revenue,
    );

  let retailId: string;
  let adminEmail: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    (app.getHttpAdapter().getInstance() as Express).set('trust proxy', true);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    // Listen ONCE, up front. This suite fires 10-40 simultaneous requests
    // (P1-3, P1-8). Given a server that is not listening, supertest starts it
    // for each request and closes it when that request ends — so the first
    // request to finish shut the shared server under the others, which then
    // failed with "read ECONNRESET" on slower CI runners.
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    const config = app.get(ConfigService);
    merchantId = config.get<string>('PAYHERE_MERCHANT_ID')!;
    merchantSecret = config.get<string>('PAYHERE_MERCHANT_SECRET')!;

    retailId = await seedProduct('retail', { stock: 500 });
    const admin = await seedUser('admin', { role: UserRole.ADMIN });
    adminEmail = admin.email!;
    adminToken = (await login(adminEmail)).token;
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.paymentWebhookEvent.deleteMany({
      where: { transactionId: { startsWith: TAG } },
    });
    await prisma.contactVerificationCode.deleteMany({
      where: { contact: { contains: TAG } },
    });
    await prisma.order.deleteMany({
      where: { user: { email: { startsWith: TAG } } },
    });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await app.close();
  });

  // ═══ P0-1: guest checkout handed out sessions for existing accounts ═══════
  describe('P0-1 · guest checkout cannot log in as an existing account', () => {
    it('the attack from the report: guest checkout with an ADMIN email returns no session', async () => {
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: adminEmail },
      });
      const ordersBefore = await prisma.order.count({
        where: { userId: admin.id },
      });

      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ email: adminEmail }));

      expect(res.status).toBe(409);
      expect(errCode(res)).toBe('LOGIN_REQUIRED');
      expect(data(res)).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/accessToken/);
      expect(refreshCookie(res)).toBeUndefined();
      expect(await prisma.order.count({ where: { userId: admin.id } })).toBe(
        ordersBefore,
      );
    });

    it('the seeded shop admin (admin@textileshop.com) is refused the same way', async () => {
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ email: 'admin@textileshop.com' }));
      expect(res.status).toBe(409);
      expect(errCode(res)).toBe('LOGIN_REQUIRED');
      expect(refreshCookie(res)).toBeUndefined();
    });

    it("an existing account's PHONE with a fresh email is refused too", async () => {
      const victim = await seedUser(`victim-${uniq()}`);
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ phone: victim.phone }));
      expect(res.status).toBe(409);
      expect(errCode(res)).toBe('LOGIN_REQUIRED');
    });

    it('a brand-new guest gets a session — for a NEW customer account only', async () => {
      const body = guestBody();
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(body);

      expect(res.status).toBe(201);
      expect(data(res).session.user.role).toBe('CUSTOMER');
      expect(data(res).session.user.email).toBe(body.email);
      expect(data(res).session.refreshToken).toBeUndefined();
      expect(refreshCookie(res)).toBeDefined();
    });
  });

  // ═══ P0-2: anyone could sell out the shop; reservations never expired ═════
  describe('P0-2 · stock cannot be locked up by unpaid orders', () => {
    it('rejects a quantity above the per-line cap (the report reserved 30 at once)', async () => {
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ items: [{ productId: retailId, quantity: 30 }] }));
      expect(res.status).toBe(400);
    });

    it('rejects a junk phone number (the report used "x")', async () => {
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ phone: 'x' }));
      expect(res.status).toBe(400);
    });

    it('rejects an empty cart (P2-1)', async () => {
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(guestBody({ items: [] }));
      expect(res.status).toBe(400);
    });

    it('caps unpaid guest orders per IP address', async () => {
      process.env.MAX_OPEN_GUEST_ORDERS_PER_IP = '2';
      try {
        const attacker = ip();
        for (let i = 0; i < 2; i++) {
          const ok = await http()
            .post('/orders/guest-checkout')
            .set('X-Forwarded-For', attacker)
            .send(guestBody());
          expect(ok.status).toBe(201);
        }
        const third = await http()
          .post('/orders/guest-checkout')
          .set('X-Forwarded-For', attacker)
          .send(guestBody());
        expect(third.status).toBe(429);
        expect(errCode(third)).toBe('TOO_MANY_PENDING_ORDERS');

        // Another address is unaffected.
        const other = await http()
          .post('/orders/guest-checkout')
          .set('X-Forwarded-For', ip())
          .send(guestBody());
        expect(other.status).toBe(201);
      } finally {
        delete process.env.MAX_OPEN_GUEST_ORDERS_PER_IP;
      }
    });

    it('caps unpaid orders per account', async () => {
      process.env.MAX_OPEN_PENDING_ORDERS_PER_USER = '2';
      try {
        const customer = await seedUser(`capped-${uniq()}`);
        const { token } = await login(customer.email!);
        const place = () =>
          http()
            .post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
              items: [{ productId: retailId, quantity: 1 }],
              shippingAddress: address,
            });
        expect((await place()).status).toBe(201);
        expect((await place()).status).toBe(201);
        const third = await place();
        expect(third.status).toBe(429);
        expect(errCode(third)).toBe('TOO_MANY_PENDING_ORDERS');
      } finally {
        delete process.env.MAX_OPEN_PENDING_ORDERS_PER_USER;
      }
    });

    it('an unpaid order past its reservation window is cancelled and its stock — including per-size — comes back', async () => {
      const sizedId = await seedProduct(`expiry-sized-${uniq()}`, {
        stock: 10,
        attributes: { size: 'M, L', sizeStock: { M: 5, L: 5 } },
      });
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(
          guestBody({
            items: [
              {
                productId: sizedId,
                quantity: 3,
                selectedAttributes: { size: 'M' },
              },
            ],
          }),
        );
      expect(res.status).toBe(201);
      const orderId = data(res).order.id as string;

      // A fresh order stays reserved.
      await app.get(OrderExpiryService).sweep();
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: orderId } }))
          .status,
      ).toBe(OrderStatus.PENDING);
      const held = await prisma.product.findUniqueOrThrow({
        where: { id: sizedId },
      });
      expect(held.stockQuantity).toBe(7);
      expect((held.attributes as any).sizeStock.M).toBe(2);

      // 31 minutes later (default window: 30).
      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 31 * 60_000) },
      });
      await app.get(OrderExpiryService).sweep();

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { statusHistory: true },
      });
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(
        order.statusHistory.some((h) =>
          /Automatically cancelled/.test(h.note ?? ''),
        ),
      ).toBe(true);

      const released = await prisma.product.findUniqueOrThrow({
        where: { id: sizedId },
        include: { inventory: true },
      });
      expect(released.stockQuantity).toBe(10);
      expect(released.inventory!.quantityReserved).toBe(0);
      expect((released.attributes as any).sizeStock.M).toBe(5);
    });

    it('never expires a confirmed (Cash on Delivery) order', async () => {
      const customer = await seedUser(`cod-keep-${uniq()}`);
      const { token } = await login(customer.email!);
      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: retailId, quantity: 1 }],
          shippingAddress: address,
        });
      const orderId = data(placed).id;
      const cod = await http()
        .post('/payments/cod')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId });
      expect(cod.status).toBe(201);
      expect(data(cod).orderStatus).toBe('CONFIRMED');

      await prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 120 * 60_000) },
      });
      await app.get(OrderExpiryService).sweep();
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: orderId } }))
          .status,
      ).toBe(OrderStatus.CONFIRMED);
    });
  });

  // ═══ P1-1: a forged PayHere notify poisoned idempotency ═════════════════
  describe('P1-1 · a forged PayHere notify cannot block the real one', () => {
    it('the attack from the report: forged first, genuine second → the order IS confirmed', async () => {
      const customer = await seedUser(`p11-${uniq()}`);
      const { token } = await login(customer.email!);
      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: retailId, quantity: 1 }],
          shippingAddress: address,
        });
      const order = data(placed);
      const created = await http()
        .post('/payments/payhere/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: order.id });
      expect(created.status).toBe(201);

      const paymentId = `${TAG}-320000777`;
      const genuine = signedNotify({
        orderRef: order.orderNumber,
        paymentId,
        amount: '1000.00',
      });

      const forged = await http()
        .post('/payments/payhere/notify')
        .set('X-Forwarded-For', ip())
        .send({ ...genuine, md5sig: 'BAD' + genuine.md5sig.slice(3) });
      expect(forged.status).toBe(201);

      const real = await http().post('/payments/payhere/notify').send(genuine);
      expect(real.status).toBe(201);
      expect(data(real).duplicate).toBeUndefined();

      const after = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payment: true },
      });
      expect(after.status).toBe(OrderStatus.CONFIRMED);
      expect(after.payment!.status).toBe(PaymentStatus.COMPLETED);

      const events = await prisma.paymentWebhookEvent.findMany({
        where: { transactionId: paymentId },
        orderBy: { createdAt: 'asc' },
      });
      expect(events.map((e) => e.signatureValid)).toEqual([false, true]);
      expect(events[0].processingError).toBe('INVALID_SIGNATURE');
      expect(events[1].processingError).toBeNull();

      // A genuine REDELIVERY is still idempotent: no second SALE.
      const replay = await http()
        .post('/payments/payhere/notify')
        .send(genuine);
      expect(data(replay).duplicate).toBe(true);
      const sales = await prisma.inventoryMovement.count({
        where: { orderId: order.id, type: MovementType.SALE },
      });
      expect(sales).toBe(1);
    });

    it('a notify with no payment_id is rejected and stores nothing', async () => {
      const before = await prisma.paymentWebhookEvent.count();
      const res = await http().post('/payments/payhere/notify').send({
        merchant_id: merchantId,
        order_id: 'X',
        status_code: '2',
        md5sig: 'x',
      });
      expect(res.status).toBe(400);
      expect(await prisma.paymentWebhookEvent.count()).toBe(before);
    });
  });

  // ═══ P1-2: payments accepted on cancelled orders, counted as revenue ═════
  describe('P1-2 · cancelled orders cannot be paid, and late money is not revenue', () => {
    it('COD and PayHere are refused on a cancelled order (it used to answer "CONFIRMED")', async () => {
      const customer = await seedUser(`p12a-${uniq()}`);
      const { token } = await login(customer.email!);
      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: retailId, quantity: 1 }],
          shippingAddress: address,
        });
      const orderId = data(placed).id;
      await http()
        .put(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const cod = await http()
        .post('/payments/cod')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId });
      expect(cod.status).toBe(400);
      expect(errCode(cod)).toBe('ORDER_NOT_PAYABLE');

      const payhere = await http()
        .post('/payments/payhere/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId });
      expect(payhere.status).toBe(400);
      expect(errCode(payhere)).toBe('ORDER_NOT_PAYABLE');

      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: orderId } }))
          .status,
      ).toBe(OrderStatus.CANCELLED);
    });

    it('a signed payment landing AFTER cancellation is flagged for refund and never counted as revenue', async () => {
      const customer = await seedUser(`p12b-${uniq()}`);
      const { token } = await login(customer.email!);
      const price8900 = await seedProduct(`p12b-${uniq()}`, {
        price: 8900,
        stock: 5,
      });
      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: price8900, quantity: 1 }],
          shippingAddress: address,
        });
      const order = data(placed);
      await http()
        .post('/payments/payhere/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: order.id })
        .expect(201);
      await http()
        .put(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const revenueBefore = await revenueNow();
      const paymentId = `${TAG}-late-${uniq()}`;
      await http()
        .post('/payments/payhere/notify')
        .send(
          signedNotify({
            orderRef: order.orderNumber,
            paymentId,
            amount: '8900.00',
          }),
        )
        .expect(201);

      const after = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payment: true },
      });
      expect(after.status).toBe(OrderStatus.CANCELLED); // never resurrected
      expect(after.payment!.status).toBe(PaymentStatus.COMPLETED); // the truth: money arrived
      const event = await prisma.paymentWebhookEvent.findFirstOrThrow({
        where: { transactionId: paymentId, signatureValid: true },
      });
      expect(event.processingError).toBe('PAID_AFTER_CANCEL');

      const alert = await prisma.notification.findFirst({
        where: { type: 'payment.paid_after_cancel', targetId: order.id },
      });
      expect(alert).not.toBeNull();

      // The report saw "revenue Rs 8,900" from exactly this. Now: unchanged.
      expect(await revenueNow()).toBeCloseTo(revenueBefore, 2);
      const facts = await prisma.$queryRaw<Array<{ payment_status: string }>>`
        SELECT DISTINCT payment_status FROM ai_sales_facts WHERE order_id = ${order.id}::uuid`;
      expect(facts.map((f) => f.payment_status)).toEqual(['VOID']);
    });
  });

  // ═══ P1-3: OTP lockout was bypassable by a concurrent burst ═════════════
  describe('P1-3 · one-time codes allow at most 5 guesses, even under a burst', () => {
    async function userWithCode(code: string) {
      const user = await seedUser(`otp-${uniq()}`, { emailVerified: false });
      await prisma.verificationCode.create({
        data: {
          userId: user.id,
          channel: VerificationChannel.EMAIL,
          codeHash: sha256(code),
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      });
      const { token } = await login(user.email!);
      return { user, token };
    }
    const guess = (token: string, code: string) =>
      http()
        .post('/auth/verify-code')
        .set('Authorization', `Bearer ${token}`)
        .send({ channel: 'EMAIL', code });

    it('the attack from the report: the correct code AFTER a burst of wrong ones is locked out', async () => {
      const { user, token } = await userWithCode('424242');
      const wrong = Array.from({ length: 30 }, (_, i) => String(100000 + i));
      await Promise.all(wrong.map((c) => guess(token, c)));

      const res = await guess(token, '424242'); // the 31st guess
      expect(res.status).toBe(400);
      expect(errCode(res)).toBe('OTP_LOCKED');
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .emailVerified,
      ).toBe(false);
    });

    it('a 40-way concurrent burst gets at most 5 comparisons', async () => {
      const { user } = await userWithCode('515151');
      const { token } = await login(user.email!);
      const codes = Array.from({ length: 40 }, (_, i) =>
        i === 30 ? '515151' : String(200000 + i),
      );
      const results = await Promise.all(codes.map((c) => guess(token, c)));

      const notLocked = results.filter((r) => errCode(r) !== 'OTP_LOCKED');
      expect(notLocked.length).toBeLessThanOrEqual(5);
      expect(
        results.filter((r) => errCode(r) === 'OTP_LOCKED').length,
      ).toBeGreaterThanOrEqual(35);

      const row = await prisma.verificationCode.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(row.attempts).toBe(5);
    });
  });

  // ═══ P1-4: rate limits, lockout, timing ═════════════════════════════════
  describe('P1-4 · credential stuffing', () => {
    it('X-Forwarded-For is trusted only from real proxy hops (default: none)', () => {
      const saved = {
        hops: process.env.TRUST_PROXY_HOPS,
        render: process.env.RENDER,
      };
      try {
        delete process.env.TRUST_PROXY_HOPS;
        delete process.env.RENDER;
        expect(trustProxyHops()).toBe(0); // direct deployment: XFF ignored
        process.env.RENDER = 'true';
        expect(trustProxyHops()).toBe(1); // Render: one proxy
        process.env.TRUST_PROXY_HOPS = '2';
        expect(trustProxyHops()).toBe(2); // explicit
      } finally {
        if (saved.hops === undefined) delete process.env.TRUST_PROXY_HOPS;
        else process.env.TRUST_PROXY_HOPS = saved.hops;
        if (saved.render === undefined) delete process.env.RENDER;
        else process.env.RENDER = saved.render;
      }
    });

    it('locks an account after 5 wrong passwords — even the right password is then refused', async () => {
      const user = await seedUser(`lock-${uniq()}`);
      for (let i = 0; i < 5; i++) {
        const res = await http()
          .post('/auth/login')
          .set('X-Forwarded-For', ip()) // a different "IP" every time, as in the report
          .send({ identifier: user.email, password: `Wrong#Pass${i}` });
        expect(res.status).toBe(401);
      }
      const right = await http()
        .post('/auth/login')
        .set('X-Forwarded-For', ip())
        .send({ identifier: user.email, password: 'Correct#Pass1' });
      expect(right.status).toBe(401);
      expect(errCode(right)).toBe('ACCOUNT_LOCKED');
      expect(
        (
          await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        ).lockedUntil!.getTime(),
      ).toBeGreaterThan(Date.now());
    });

    it('an unknown email costs the same bcrypt time as a real one (no enumeration by timing)', async () => {
      const user = await seedUser(`timing-${uniq()}`, { cost: 12 });
      const time = async (identifier: string) => {
        const start = process.hrtime.bigint();
        await http()
          .post('/auth/login')
          .set('X-Forwarded-For', ip())
          .send({ identifier, password: 'Wrong#Pass0' });
        return Number(process.hrtime.bigint() - start) / 1e6;
      };
      await time(`${TAG}-warmup-${uniq()}@example.test`); // builds the equalizer hash once
      const median = (xs: number[]) =>
        xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const known = median([
        await time(user.email!),
        await time(user.email!),
        await time(user.email!),
      ]);
      const unknown = median([
        await time(`${TAG}-nobody-${uniq()}@example.test`),
        await time(`${TAG}-nobody-${uniq()}@example.test`),
        await time(`${TAG}-nobody-${uniq()}@example.test`),
      ]);
      // The report measured 323 ms vs 5 ms. Both now pay for bcrypt.
      expect(unknown).toBeGreaterThan(known * 0.5);
    });
  });

  // ═══ P1-5: deactivated users kept access through refresh ════════════════
  describe('P1-5 · a deactivated account loses access immediately', () => {
    it('refresh is refused, the old access token stops working, and every refresh token is revoked', async () => {
      const user = await seedUser(`deact-${uniq()}`);
      const { token, res } = await login(user.email!);
      const cookie = refreshCookie(res)!.split(';')[0];

      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      const refreshed = await http()
        .post('/auth/refresh')
        .set('Cookie', cookie);
      expect(refreshed.status).toBe(401);

      const me = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(me.status).toBe(401);

      expect(
        await prisma.refreshToken.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);
    });
  });

  // ═══ P1-6: per-size stock oversold under concurrency ════════════════════
  describe('P1-6 · per-size stock is race-safe', () => {
    it('the attack from the report: 10 parallel orders for size M (stock 2) → exactly 2 succeed', async () => {
      const sizedId = await seedProduct(`race-${uniq()}`, {
        stock: 12,
        attributes: { size: 'M, L', sizeStock: { M: 2, L: 10 } },
      });
      const customer = await seedUser(`race-${uniq()}`);
      const { token } = await login(customer.email!);

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          http()
            .post('/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
              items: [
                {
                  productId: sizedId,
                  quantity: 1,
                  selectedAttributes: { size: 'M' },
                },
              ],
              shippingAddress: address,
            }),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.status === 400)).toHaveLength(8);

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: sizedId },
        include: { inventory: true },
      });
      expect((product.attributes as any).sizeStock).toEqual({ M: 0, L: 10 });
      expect(product.inventory!.quantityReserved).toBe(2);
      expect(product.stockQuantity).toBe(10);
    });

    it('rejects an unknown size and a missing size on a per-size product', async () => {
      const sizedId = await seedProduct(`size-${uniq()}`, {
        stock: 5,
        attributes: { size: 'S, M', sizeStock: { S: 2, M: 3 } },
      });
      const customer = await seedUser(`size-${uniq()}`);
      const { token } = await login(customer.email!);
      const order = (attrs?: Record<string, string>) =>
        http()
          .post('/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [
              {
                productId: sizedId,
                quantity: 1,
                ...(attrs ? { selectedAttributes: attrs } : {}),
              },
            ],
            shippingAddress: address,
          });

      expect((await order({ size: 'XXXXXXL' })).status).toBe(400);
      expect((await order()).status).toBe(400);
      expect((await order({ size: 'M', price: '1' })).status).toBe(400); // P2-3
    });

    it('admin stock adjust refuses a size the product does not have (P2-3)', async () => {
      const sizedId = await seedProduct(`adj-${uniq()}`, {
        stock: 5,
        attributes: { size: 'S, M', sizeStock: { S: 2, M: 3 } },
      });
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: adminEmail },
      });
      await expect(
        app
          .get(InventoryService)
          .adjust(sizedId, 5, MovementType.PURCHASE, admin.id, 'x', 'NOPE'),
      ).rejects.toThrow(/not a size of this product/);
    });
  });

  // ═══ P1-7: installments broken end to end ══════════════════════════════
  describe('P1-7 · installments work end to end, paid online through PayHere', () => {
    let customerToken: string;
    let order: { id: string; orderNumber: string };

    beforeAll(async () => {
      const customer = await seedUser(`inst-${uniq()}`);
      customerToken = (await login(customer.email!)).token;
      const productId = await seedProduct(`inst-${uniq()}`, {
        price: 8900,
        stock: 5,
      });
      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
          shippingAddress: address,
        });
      order = data(placed);
    });

    it.each([0, -2, 2.5, 500, 'abc'])(
      'rejects an installment count of %p',
      async (count) => {
        const res = await http()
          .post('/payments/installments/create')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ orderId: order.id, installmentCount: count });
        expect(res.status).toBe(400);
      },
    );

    it('splits exactly, in LKR, then takes each installment through PayHere and counts revenue per installment', async () => {
      const revenueStart = await revenueNow();

      const plan = await http()
        .post('/payments/installments/create')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: order.id, installmentCount: 3 });
      expect(plan.status).toBe(201);
      expect(data(plan).currency).toBe('LKR');
      const amounts = (
        data(plan).installments as Array<{ amount: string }>
      ).map((i) => Number(i.amount));
      expect(amounts).toEqual([2966.66, 2966.66, 2966.68]);
      expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(8900, 2);
      const [inst1, inst2, inst3] = data(plan).installments as Array<{
        id: string;
        amount: string;
      }>;

      // Installments are paid in order.
      const outOfOrder = await http()
        .post('/payments/installments/payhere')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ installmentId: inst2.id });
      expect(outOfOrder.status).toBe(400);

      // The customer path that did not exist: a PayHere checkout for installment 1.
      const checkout = await http()
        .post('/payments/installments/payhere')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ installmentId: inst1.id });
      expect(checkout.status).toBe(201);
      expect(data(checkout).params.order_id).toBe(`${order.orderNumber}-I1`);
      expect(data(checkout).params.amount).toBe('2966.66');
      expect(data(checkout).params.currency).toBe('LKR');

      await http()
        .post('/payments/payhere/notify')
        .send(
          signedNotify({
            orderRef: `${order.orderNumber}-I1`,
            paymentId: `${TAG}-i1-${uniq()}`,
            amount: '2966.66',
          }),
        )
        .expect(201);

      let state = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          payment: {
            include: { installments: { orderBy: { installmentNo: 'asc' } } },
          },
        },
      });
      expect(state.status).toBe(OrderStatus.CONFIRMED); // first installment confirms
      expect(state.payment!.status).toBe(PaymentStatus.PENDING);
      expect(state.payment!.installments.map((i) => i.status)).toEqual([
        'COMPLETED',
        'PENDING',
        'PENDING',
      ]);
      expect(state.payment!.installments[0].transactionId).toMatch(
        new RegExp(`^${TAG}-i1-`),
      );
      expect((await revenueNow()) - revenueStart).toBeCloseTo(2966.66, 2);

      // The old admin "mark paid" completed the WHOLE plan while all installments stayed unpaid.
      const wholePlan = await http()
        .post(`/payments/admin/${order.id}/mark-paid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(wholePlan.status).toBe(400);
      expect(errCode(wholePlan)).toBe('INSTALLMENT_PLAN');

      // The admin records ONE installment (cash / bank).
      await http()
        .post(`/payments/admin/installments/${inst2.id}/mark-paid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Cash at the shop' })
        .expect(201);

      // The last one online.
      await http()
        .post('/payments/payhere/notify')
        .send(
          signedNotify({
            orderRef: `${order.orderNumber}-I3`,
            paymentId: `${TAG}-i3-${uniq()}`,
            amount: inst3.amount,
          }),
        )
        .expect(201);

      state = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payment: { include: { installments: true } } },
      });
      expect(state.payment!.status).toBe(PaymentStatus.COMPLETED);
      expect(
        state.payment!.installments.every(
          (i) => i.status === PaymentStatus.COMPLETED,
        ),
      ).toBe(true);
      expect((await revenueNow()) - revenueStart).toBeCloseTo(8900, 2);

      // Once money has been taken the plan can no longer be rewritten.
      const rewrite = await http()
        .post('/payments/installments/create')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderId: order.id, installmentCount: 2 });
      expect(rewrite.status).toBe(400);
    });
  });

  // ═══ P1-8: guest COD was a dead end and squatted accounts ══════════════
  describe('P1-8 · guest Cash on Delivery works, and creates no account until the contact is verified', () => {
    it('COD without a code is refused BEFORE any account exists', async () => {
      const body = guestBody({ paymentMethod: 'COD' });
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(body);
      expect(res.status).toBe(400);
      expect(errCode(res)).toBe('VERIFICATION_REQUIRED');
      expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
    });

    it('a guest receives a code, verifies, and the COD order is placed AND confirmed', async () => {
      const body = guestBody({ paymentMethod: 'COD' });
      const sent = await http()
        .post('/orders/guest-checkout/send-code')
        .set('X-Forwarded-For', ip())
        .send({ email: body.email, phone: body.phone, channel: 'EMAIL' });
      expect(sent.status).toBe(201);
      expect(data(sent).channel).toBe('EMAIL');

      // The code went by email (never stored in plain text). Stand in for the
      // inbox by setting the stored hash to a code this test knows.
      const row = await prisma.contactVerificationCode.findFirstOrThrow({
        where: { contact: body.email },
      });
      expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
      await prisma.contactVerificationCode.update({
        where: { id: row.id },
        data: { codeHash: sha256('707070') },
      });

      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send({
          ...body,
          verificationCode: '707070',
          verificationChannel: 'EMAIL',
        });
      expect(res.status).toBe(201);
      expect(data(res).order.status).toBe('CONFIRMED');
      expect(data(res).order.payment.method).toBe('COD');
      expect(data(res).session.user.emailVerified).toBe(true);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: body.email },
      });
      expect(user.emailVerified).toBe(true);
    });

    it('a wrong code creates nothing', async () => {
      const body = guestBody({ paymentMethod: 'COD' });
      await http()
        .post('/orders/guest-checkout/send-code')
        .set('X-Forwarded-For', ip())
        .send({ email: body.email, phone: body.phone })
        .expect(201);
      const res = await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send({ ...body, verificationCode: '000999' });
      expect(res.status).toBe(400);
      expect(errCode(res)).toBe('OTP_INVALID');
      expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
    });

    it('asking for a code with an existing account says "sign in"', async () => {
      const res = await http()
        .post('/orders/guest-checkout/send-code')
        .set('X-Forwarded-For', ip())
        .send({ email: adminEmail, phone: phone() });
      expect(res.status).toBe(409);
      expect(errCode(res)).toBe('LOGIN_REQUIRED');
    });

    it('the real owner of a guest-squatted email can claim it through password reset', async () => {
      // A stranger checks out (card) with someone else's email: an unverified account.
      const body = guestBody();
      await http()
        .post('/orders/guest-checkout')
        .set('X-Forwarded-For', ip())
        .send(body)
        .expect(201);

      // The owner tries to register: told to sign in or reset — not a dead end.
      const reg = await http().post('/auth/register').send({
        email: body.email,
        password: 'Owner#Pass1',
        firstName: 'Real',
        lastName: 'Owner',
      });
      expect(reg.status).toBe(409);
      expect(reg.body.message).toMatch(/Forgot password/);

      // Reset used to require an ALREADY verified email. Now the link goes out.
      const configured = jest
        .spyOn(EmailService.prototype, 'isConfigured', 'get')
        .mockReturnValue(true);
      try {
        await http()
          .post('/auth/forgot-password')
          .send({ identifier: body.email })
          .expect(201);
      } finally {
        configured.mockRestore();
      }
      const issued = await prisma.user.findUniqueOrThrow({
        where: { email: body.email },
      });
      expect(issued.resetTokenHash).not.toBeNull();
      expect(issued.resetChannel).toBe(VerificationChannel.EMAIL);
      expect(issued.emailVerified).toBe(false);

      // The emailed token is only ever stored hashed; use one this test knows.
      const token = randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: issued.id },
        data: { resetTokenHash: sha256(token) },
      });
      await http()
        .post('/auth/reset-password')
        .send({ token, password: 'Owner#Pass1' })
        .expect(201);

      const claimed = await prisma.user.findUniqueOrThrow({
        where: { id: issued.id },
      });
      expect(claimed.emailVerified).toBe(true);
      await login(body.email, 'Owner#Pass1');
    });
  });

  // ═══ P1-9: workers could cut cloth for cancelled orders ═════════════════
  describe('P1-9 · a cancelled order leaves the production floor', () => {
    it('the attack from the report: cancel after tasks were assigned → the worker cannot start, and the task is gone from every queue', async () => {
      const uniformId = await seedProduct(`uniform-${uniq()}`, {
        price: 3000,
        stock: 20,
        productType: ProductType.UNIFORM,
        requiresMeasurement: true,
      });
      const customer = await seedUser(`p19-${uniq()}`);
      const { token } = await login(customer.email!);
      const workerUser = await seedUser(`worker-${uniq()}`, {
        role: UserRole.WORKER,
      });
      const worker = await prisma.worker.create({
        data: {
          userId: workerUser.id,
          specialization: ProductionStage.CUTTING,
        },
      });
      const workerToken = (await login(workerUser.email!)).token;

      const placed = await http()
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: uniformId, quantity: 1, measurements }],
          shippingAddress: address,
        });
      const orderId = data(placed).id;
      await http()
        .post('/payments/cod')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId })
        .expect(201);

      const [task] = await prisma.productionTask.findMany({
        where: { orderId },
      });
      expect(task).toBeDefined();
      await http()
        .put(`/production/tasks/${task.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ workerId: worker.id })
        .expect(200);

      await http()
        .put(`/orders/admin/${orderId}/action`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'cancel' })
        .expect(200);

      const start = await http()
        .put(`/production/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ action: 'start' });
      expect(start.status).toBe(409);
      expect(
        (
          await prisma.productionTask.findUniqueOrThrow({
            where: { id: task.id },
          })
        ).status,
      ).toBe('PENDING');

      const mine = await http()
        .get('/production/my-tasks')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(mine.status).toBe(200);
      expect(JSON.stringify(data(mine).queue)).not.toContain(task.id);

      const board = await http()
        .get('/production/pipeline')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(JSON.stringify(data(board))).not.toContain(task.id);

      const reassign = await http()
        .put(`/production/tasks/${task.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ workerId: worker.id });
      expect(reassign.status).toBe(409);
    });
  });
});
