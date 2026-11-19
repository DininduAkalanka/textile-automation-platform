import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import { ProductType, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Pre-handover audit (2026-11-19): the live "shorts" category had been saved
 * with the image "abcd", so every storefront page requested /abcd and got a
 * 404. Image references must now be a full web address or a site path.
 */
describe('Handover audit — catalogue image references', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const TAG = `hoa-${Date.now()}`;

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

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

    const admin = await prisma.user.create({
      data: {
        email: `${TAG}-admin@example.test`,
        passwordHash: await bcrypt.hash('Correct#Pass1', 4),
        firstName: 'Audit',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });
    const login = await http()
      .post('/auth/login')
      .set('X-Forwarded-For', '10.88.0.1')
      .send({ identifier: admin.email, password: 'Correct#Pass1' });
    expect(login.status).toBe(201);
    token = login.body.data.accessToken as string;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await app.close();
  });

  it('refuses a category image that is not an address ("abcd")', async () => {
    const res = await http()
      .post('/categories')
      .set(auth())
      .send({ name: `${TAG} shorts`, imageUrl: 'abcd' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toMatch(/imageUrl must be a full web address/);
  });

  it('accepts a site path or a full https address for a category image', async () => {
    for (const [suffix, imageUrl] of [
      ['path', '/images/categories/women.jpg'],
      ['https', 'https://res.cloudinary.com/demo/image/upload/sample.jpg'],
    ]) {
      const res = await http()
        .post('/categories')
        .set(auth())
        .send({ name: `${TAG} ${suffix}`, imageUrl });
      expect(res.status).toBe(201);
    }
  });

  it('refuses the same junk when a category is edited', async () => {
    const created = await http()
      .post('/categories')
      .set(auth())
      .send({ name: `${TAG} edit` });
    expect(created.status).toBe(201);
    const res = await http()
      .patch(`/categories/${created.body.data.id as string}`)
      .set(auth())
      .send({ imageUrl: 'not a url' });
    expect(res.status).toBe(400);
  });

  it('refuses product images that are not addresses', async () => {
    const res = await http()
      .post('/products')
      .set(auth())
      .send({
        name: `${TAG} shirt`,
        price: 1000,
        stockQuantity: 5,
        sku: `${TAG}-shirt`,
        productType: ProductType.READY_MADE,
        images: ['https://cdn.example/a.jpg', 'abcd'],
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toMatch(/each image must be a full web address/);
  });
});
