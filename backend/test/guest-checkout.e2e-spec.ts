import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { MovementType, PaymentMethod, ProductType, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Guest Checkout Suite (QA-2.2a through QA-2.2d).
 *
 * Verifies security invariants for the public guest-checkout pipeline:
 * - F-01 fix: refreshToken is stripped from the JSON response body.
 * - Cookie parity: Set-Cookie attributes match /auth/login exactly (HttpOnly, SameSite=Lax, Path=/).
 * - Session resumption: A guest with only their refresh_token cookie can silently refresh and see their order.
 * - Stale-tab resilience: An already-authenticated user submitting guest checkout resolves to their existing account without duplicating users.
 */
describe('Guest Checkout E2E (QA-2.2a - QA-2.2d)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const TAG = `guest-${Date.now()}`;
  let retailProductId: string;

  const validAddress = {
    fullName: 'Guest Buyer',
    addressLine1: '45 Lotus Road',
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
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Seed a ready-made product with ample stock
    const product = await prisma.product.create({
      data: {
        name: `Guest Ready Product ${TAG}`,
        slug: `${TAG}-product`,
        sku: `${TAG}-sku`,
        price: 2500,
        stockQuantity: 100,
        productType: ProductType.READY_MADE,
        requiresMeasurement: false,
      },
    });
    retailProductId = product.id;

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
    await prisma.order.deleteMany({
      where: { user: { email: { contains: TAG } } },
    });
    await prisma.product.deleteMany({
      where: { sku: { startsWith: TAG } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TAG } },
    });
    await app.close();
  });

  /**
   * QA-2.2a: POST /orders/guest-checkout response body must NOT leak refreshToken.
   */
  describe('[QA-2.2a] Response body sanitization', () => {
    it('returns order and session without the refreshToken key in the JSON body', async () => {
      const email = `${TAG}-guest1@example.test`;
      const payload = {
        items: [{ productId: retailProductId, quantity: 1 }],
        shippingAddress: validAddress,
        email,
        phone: '+94771234501',
        fullName: 'First Guest',
        paymentMethod: PaymentMethod.STRIPE,
      };

      const res = await request(app.getHttpServer())
        .post('/orders/guest-checkout')
        .send(payload)
        .expect(201);

      // Order created
      expect(res.body.order).toBeDefined();
      expect(res.body.order.id).toBeDefined();
      expect(res.body.order.status).toBe('PENDING');

      // Session returned with accessToken
      expect(res.body.session).toBeDefined();
      expect(res.body.session.accessToken).toBeDefined();
      expect(typeof res.body.session.accessToken).toBe('string');
      expect(res.body.session.user).toBeDefined();
      expect(res.body.session.user.email).toBe(email);

      // CRITICAL: refreshToken must be stripped from response JSON (F-01 audit finding)
      expect(res.body.session.refreshToken).toBeUndefined();
      expect('refreshToken' in res.body.session).toBe(false);
      expect(res.body.refreshToken).toBeUndefined();
    });
  });

  /**
   * QA-2.2b: Set-Cookie header parity with /auth/login.
   */
  describe('[QA-2.2b] Set-Cookie header parity with /auth/login', () => {
    it('sets refresh_token cookie with httpOnly, SameSite=Lax, Path=/, matching /auth/login', async () => {
      // 1. Seed a user and log in to capture baseline /auth/login cookie
      const baselineEmail = `${TAG}-baseline@example.test`;
      const password = 'Password123!';
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email: baselineEmail,
          passwordHash,
          firstName: 'Baseline',
          lastName: 'User',
          role: UserRole.CUSTOMER,
          emailVerified: true,
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: baselineEmail, password })
        .expect(201);

      const loginCookies: string[] = loginRes.headers['set-cookie'] || [];
      const loginRefreshCookie = loginCookies.find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(loginRefreshCookie).toBeDefined();
      expect(loginRefreshCookie).toMatch(/HttpOnly/i);
      expect(loginRefreshCookie).toMatch(/SameSite=Lax/i);
      expect(loginRefreshCookie).toMatch(/Path=\//i);

      // 2. Perform guest checkout and inspect its Set-Cookie header
      const guestEmail = `${TAG}-guest2@example.test`;
      const guestRes = await request(app.getHttpServer())
        .post('/orders/guest-checkout')
        .send({
          items: [{ productId: retailProductId, quantity: 1 }],
          shippingAddress: validAddress,
          email: guestEmail,
          phone: '+94771234502',
          fullName: 'Second Guest',
          paymentMethod: PaymentMethod.STRIPE,
        })
        .expect(201);

      const guestCookies: string[] = guestRes.headers['set-cookie'] || [];
      const guestRefreshCookie = guestCookies.find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(guestRefreshCookie).toBeDefined();

      // Assert identical security attributes
      expect(guestRefreshCookie).toMatch(/^refresh_token=[^;]+/);
      expect(guestRefreshCookie).toMatch(/HttpOnly/i);
      expect(guestRefreshCookie).toMatch(/SameSite=Lax/i);
      expect(guestRefreshCookie).toMatch(/Path=\//i);

      if (process.env.NODE_ENV === 'production') {
        expect(guestRefreshCookie).toMatch(/Secure/i);
      }
    });
  });

  /**
   * QA-2.2c: Session resumption via silent refresh.
   */
  describe('[QA-2.2c] Silent refresh session resumption', () => {
    it('allows a returning guest to silently refresh with cookie and access their order', async () => {
      const email = `${TAG}-guest3@example.test`;
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders/guest-checkout')
        .send({
          items: [{ productId: retailProductId, quantity: 1 }],
          shippingAddress: validAddress,
          email,
          phone: '+94771234503',
          fullName: 'Third Guest',
          paymentMethod: PaymentMethod.STRIPE,
        })
        .expect(201);

      const placedOrderId = checkoutRes.body.order.id;

      // Extract the refresh_token cookie value
      const cookies: string[] = checkoutRes.headers['set-cookie'] || [];
      const cookieHeader = cookies.find((c) => c.startsWith('refresh_token='));
      expect(cookieHeader).toBeDefined();
      const tokenMatch = cookieHeader!.match(/refresh_token=([^;]+)/);
      expect(tokenMatch).not.toBeNull();
      const rawRefreshToken = tokenMatch![1];

      // Simulate return visit: client sends ONLY the refresh_token cookie to /auth/refresh
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [`refresh_token=${rawRefreshToken}`])
        .expect(201);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.user).toBeDefined();
      expect(refreshRes.body.user.email).toBe(email);

      const newAccessToken = refreshRes.body.accessToken;

      // Access authenticated route /orders with the refreshed accessToken
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      const userOrders = ordersRes.body.orders as Array<{ id: string }>;
      expect(userOrders.some((o) => o.id === placedOrderId)).toBe(true);
    });
  });

  /**
   * QA-2.2d: Authenticated user hitting guest checkout (stale-tab edge case).
   */
  describe('[QA-2.2d] Authenticated user hitting guest checkout (stale tab)', () => {
    it('associates order with existing account without duplicating users', async () => {
      // 1. Create registered user
      const existingEmail = `${TAG}-existing@example.test`;
      const existingPhone = '+94779998877';
      const password = 'SecretPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);
      const existingUser = await prisma.user.create({
        data: {
          email: existingEmail,
          phone: existingPhone,
          firstName: 'Existing',
          lastName: 'Customer',
          passwordHash,
          role: UserRole.CUSTOMER,
          emailVerified: true,
          phoneVerified: true,
        },
      });

      // 2. User logs in
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: existingEmail, password })
        .expect(201);
      const userToken = loginRes.body.accessToken;

      // 3. User submits guest checkout with the same email/phone
      const guestRes = await request(app.getHttpServer())
        .post('/orders/guest-checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: retailProductId, quantity: 2 }],
          shippingAddress: validAddress,
          email: existingEmail,
          phone: existingPhone,
          fullName: 'Existing Customer',
          paymentMethod: PaymentMethod.STRIPE,
        })
        .expect(201);

      // Verify order is linked to the existing user's ID
      expect(guestRes.body.order.userId).toBe(existingUser.id);

      // Verify no duplicate user was created in the database
      const userCount = await prisma.user.count({
        where: { email: existingEmail },
      });
      expect(userCount).toBe(1);

      // Verify order is visible in the user's order history
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userOrders = ordersRes.body.orders as Array<{ id: string }>;
      expect(userOrders.some((o) => o.id === guestRes.body.order.id)).toBe(true);
    });
  });
});
