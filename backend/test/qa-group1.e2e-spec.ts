import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import {
  OrderStatus,
  ProductType,
  UploadPurpose,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UploadCleanupService } from '../src/uploads/upload-cleanup.service';
import { UPLOAD_DIR } from '../src/uploads/uploads.service';

/**
 * QA remediation, Group 1 — security / production-risk P2 findings.
 *
 * P2-4  Client mistakes (bad query values, oversized or malformed bodies)
 *       came back as 500 Internal Server Error.
 * P2-15 Any signed-in customer could upload images without limit, the image
 *       URL was built from the client's Host header, and a review could carry
 *       any URL — another customer's upload or an outside site — as a photo.
 *
 * Same harness as qa-remediation.e2e-spec.ts: the real AppModule over a real
 * Postgres, with the production validation pipe, error filter and envelope.
 */
describe('QA remediation — Group 1 (P2 security) regression suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const TAG = `qag1-${Date.now()}`;
  let counter = 0;
  const phoneSeed = Number(String(Date.now()).slice(-7));
  const phone = () =>
    `+9476${String((phoneSeed + counter++ * 7919) % 10_000_000).padStart(7, '0')}`;
  let ipCounter = 1;
  const ip = () => {
    const n = ipCounter++;
    return `10.77.${(n >> 8) & 255}.${n & 255}`;
  };

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => res.body.data;
  const errCode = (res: request.Response) => res.body.error?.code;

  /** The smallest valid PNG: real magic bytes, so it passes the signature check. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );

  const filesWritten: string[] = [];
  const savedEnv: Record<string, string | undefined> = {};
  const setEnv = (key: string, value: string | undefined) => {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  let productId: string;
  let alice: { id: string; token: string; orderId: string };
  let bob: { id: string; token: string; orderId: string };

  async function seedCustomer(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `${TAG}-${label}@example.test`,
        phone: phone(),
        passwordHash: await bcrypt.hash('Correct#Pass1', 4),
        firstName: label,
        lastName: 'Tester',
        role: UserRole.CUSTOMER,
        emailVerified: true,
      },
    });
    const login = await http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip())
      .send({ identifier: user.email, password: 'Correct#Pass1' });
    expect(login.status).toBe(201);

    // A delivered order containing the product, so the customer may review it.
    const order = await prisma.order.create({
      data: {
        orderNumber: `${TAG}-${label}`,
        userId: user.id,
        subtotal: 1000,
        total: 1000,
        status: OrderStatus.DELIVERED,
        items: {
          create: { productId, quantity: 1, unitPrice: 1000, totalPrice: 1000 },
        },
      },
    });
    return {
      id: user.id,
      token: data(login).accessToken as string,
      orderId: order.id,
    };
  }

  async function uploadReviewPhoto(
    token: string,
    opts: { host?: string } = {},
  ) {
    let req = http()
      .post('/uploads/review-image')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ip());
    if (opts.host) req = req.set('Host', opts.host);
    const res = await req.attach('file', PNG, {
      filename: 'photo.png',
      contentType: 'image/png',
    });
    if (res.status === 201) filesWritten.push(data(res).filename as string);
    return res;
  }

  const reviewBody = (orderId: string, images: string[]) => ({
    productId,
    orderId,
    rating: 5,
    title: 'Lovely fabric',
    comment: 'The cotton is soft and the colour matched the photos well.',
    fabricRating: 5,
    colorAccuracyRating: 5,
    comfortRating: 4,
    sizeFeedback: 'TRUE_TO_SIZE',
    wouldRecommend: true,
    images,
  });

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
    await app.init();
    prisma = app.get(PrismaService);

    productId = (
      await prisma.product.create({
        data: {
          name: `QA Group1 cotton ${TAG}`,
          slug: `${TAG}-cotton`,
          sku: `${TAG}-cotton`,
          price: 1000,
          stockQuantity: 10,
          productType: ProductType.READY_MADE,
        },
      })
    ).id;
    alice = await seedCustomer('alice');
    bob = await seedCustomer('bob');
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete savedEnv[key];
    }
  });

  afterAll(async () => {
    await prisma.uploadedImage.deleteMany({
      where: { filename: { in: filesWritten } },
    });
    for (const name of filesWritten) {
      const path = join(UPLOAD_DIR, name);
      if (existsSync(path)) unlinkSync(path);
    }
    await prisma.review.deleteMany({
      where: { user: { email: { startsWith: TAG } } },
    });
    await prisma.order.deleteMany({
      where: { user: { email: { startsWith: TAG } } },
    });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await app.close();
  });

  // ═══ P2-4: client mistakes are 4xx, not 500 ═══════════════════════════════
  describe('P2-4 · bad input is a 400-class answer, never a 500', () => {
    it('a non-numeric price filter is a 400 (was a 500 from Prisma)', async () => {
      const res = await http().get('/products?minPrice=abc');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('a malformed category id is a 400 (was a 500 from Postgres)', async () => {
      const res = await http().get('/products?categoryId=not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('valid filters still work', async () => {
      const res = await http().get('/products?minPrice=10&maxPrice=5000');
      expect(res.status).toBe(200);
    });

    it('a negative recommendation limit is clamped, not passed to SQL', async () => {
      for (const path of ['related', 'frequently-bought-together']) {
        const res = await http().get(`/products/${productId}/${path}?limit=-5`);
        expect(res.status).toBe(200);
      }
    });

    it('an oversized JSON body is a 413 with a fixed message (was a 500)', async () => {
      const res = await http()
        .post('/auth/login')
        .set('X-Forwarded-For', ip())
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({ identifier: 'x'.repeat(300_000), password: 'x' }),
        );
      expect(res.status).toBe(413);
      expect(errCode(res)).toBe('PAYLOAD_TOO_LARGE');
      expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
    });

    it('a malformed JSON body is a 400', async () => {
      const res = await http()
        .post('/auth/login')
        .set('X-Forwarded-For', ip())
        .set('Content-Type', 'application/json')
        .send('{"identifier": "a",');
      expect(res.status).toBe(400);
    });
  });

  // ═══ P2-15: uploads and review photos ═════════════════════════════════════
  describe('P2-15 · uploads are recorded, capped, and review photos must be your own', () => {
    it('the upload URL comes from configuration, not the Host header', async () => {
      setEnv('PUBLIC_API_URL', 'https://api.shop.test');
      const res = await uploadReviewPhoto(alice.token, {
        host: 'attacker.example',
      });
      expect(res.status).toBe(201);
      expect(data(res).url).toBe(
        `https://api.shop.test/uploads/${data(res).filename}`,
      );
      expect(data(res).url).not.toMatch(/attacker/);
    });

    it('every upload is recorded with its uploader', async () => {
      const res = await uploadReviewPhoto(alice.token);
      expect(res.status).toBe(201);
      const row = await prisma.uploadedImage.findUnique({
        where: { filename: data(res).filename as string },
      });
      expect(row).toMatchObject({
        uploadedById: alice.id,
        purpose: UploadPurpose.REVIEW,
        attachedAt: null,
      });
    });

    it('the daily quota refuses further uploads with a 429, before anything is written', async () => {
      const used = await prisma.uploadedImage.count({
        where: { uploadedById: alice.id },
      });
      setEnv('REVIEW_UPLOADS_PER_DAY', String(used));
      const filesBefore = filesWritten.length;

      const res = await uploadReviewPhoto(alice.token);
      expect(res.status).toBe(429);
      expect(errCode(res)).toBe('UPLOAD_QUOTA_EXCEEDED');
      expect(filesWritten.length).toBe(filesBefore);
      expect(
        await prisma.uploadedImage.count({ where: { uploadedById: alice.id } }),
      ).toBe(used);
    });

    it('a review cannot use an image from an outside site', async () => {
      const res = await http()
        .post('/reviews')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(reviewBody(alice.orderId, ['https://evil.example/fake.jpg']));
      expect(res.status).toBe(400);
      expect(errCode(res)).toBe('INVALID_REVIEW_IMAGE');
    });

    it("a review cannot use another customer's upload", async () => {
      const bobs = await uploadReviewPhoto(bob.token);
      expect(bobs.status).toBe(201);

      const res = await http()
        .post('/reviews')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(reviewBody(alice.orderId, [data(bobs).url as string]));
      expect(res.status).toBe(400);
      expect(errCode(res)).toBe('INVALID_REVIEW_IMAGE');
    });

    it('a review with your own upload is stored on the shop origin and the photo marked attached', async () => {
      setEnv('PUBLIC_API_URL', 'https://api.shop.test');
      const upload = await uploadReviewPhoto(alice.token);
      expect(upload.status).toBe(201);
      const filename = data(upload).filename as string;

      // Sent with a foreign origin on purpose.
      const res = await http()
        .post('/reviews')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(
          reviewBody(alice.orderId, [
            `https://elsewhere.example/uploads/${filename}`,
          ]),
        );
      expect(res.status).toBe(201);
      expect(data(res).images).toEqual([
        `https://api.shop.test/uploads/${filename}`,
      ]);
      const row = await prisma.uploadedImage.findUnique({
        where: { filename },
      });
      expect(row?.attachedAt).not.toBeNull();
    });

    it('the cleanup removes only stale, unattached, unreferenced review photos', async () => {
      const dayAgo = new Date(Date.now() - 48 * 3600_000);
      const make = async (purpose: UploadPurpose) => {
        const filename = `${randomUUID()}.png`;
        writeFileSync(join(UPLOAD_DIR, filename), PNG);
        filesWritten.push(filename);
        await prisma.uploadedImage.create({
          data: {
            filename,
            purpose,
            sizeBytes: PNG.length,
            uploadedById: alice.id,
            createdAt: dayAgo,
          },
        });
        return filename;
      };
      const orphan = await make(UploadPurpose.REVIEW);
      const catalogue = await make(UploadPurpose.CATALOGUE);
      const referenced = await make(UploadPurpose.REVIEW);
      // Referenced by a review even though it was never marked attached.
      await prisma.review.updateMany({
        where: { userId: alice.id },
        data: { images: [`https://api.shop.test/uploads/${referenced}`] },
      });

      const { removed } = await app.get(UploadCleanupService).sweep();

      expect(removed).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(UPLOAD_DIR, orphan))).toBe(false);
      expect(
        await prisma.uploadedImage.findUnique({ where: { filename: orphan } }),
      ).toBeNull();
      for (const kept of [catalogue, referenced]) {
        expect(existsSync(join(UPLOAD_DIR, kept))).toBe(true);
        expect(
          await prisma.uploadedImage.findUnique({ where: { filename: kept } }),
        ).not.toBeNull();
      }
    });
  });
});
