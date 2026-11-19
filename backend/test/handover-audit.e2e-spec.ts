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
    expect(JSON.stringify(res.body.message)).toMatch(
      /imageUrl must be a full web address/,
    );
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

  it('treats an empty image field as "no image", and clearing it removes the image', async () => {
    const created = await http()
      .post('/categories')
      .set(auth())
      .send({ name: `${TAG} blank`, imageUrl: '' });
    expect(created.status).toBe(201);
    expect(created.body.data.imageUrl).toBeNull();

    const withImage = await http()
      .post('/categories')
      .set(auth())
      .send({
        name: `${TAG} removable`,
        imageUrl: '/images/categories/men.jpg',
      });
    expect(withImage.status).toBe(201);
    const cleared = await http()
      .patch(`/categories/${withImage.body.data.id as string}`)
      .set(auth())
      .send({ imageUrl: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.imageUrl).toBeNull();
  });

  it('an archived product no longer opens from an old link, and opens again once restored', async () => {
    const created = await http()
      .post('/products')
      .set(auth())
      .send({
        name: `${TAG} archived tee`,
        price: 1500,
        stockQuantity: 3,
        sku: `${TAG}-archived`,
        productType: ProductType.READY_MADE,
      });
    expect(created.status).toBe(201);
    const { id, slug } = created.body.data as { id: string; slug: string };

    expect((await http().get(`/products/slug/${slug}`)).status).toBe(200);
    expect((await http().delete(`/products/${id}`).set(auth())).status).toBe(
      200,
    );

    // Gone for shoppers: by slug, by id, and by id passed as a slug.
    expect((await http().get(`/products/slug/${slug}`)).status).toBe(404);
    expect((await http().get(`/products/${id}`)).status).toBe(404);
    expect((await http().get(`/products/slug/${id}`)).status).toBe(404);
    // Still there for the admin, who can restore it.
    const archived = await http()
      .get(
        '/products/admin/all?archivedOnly=true&search=' +
          encodeURIComponent(`${TAG}-archived`),
      )
      .set(auth());
    expect(archived.status).toBe(200);
    expect(
      archived.body.data.products.map((p: { id: string }) => p.id),
    ).toContain(id);

    const restored = await http()
      .patch(`/products/${id}`)
      .set(auth())
      .send({ isActive: true });
    expect(restored.status).toBe(200);
    expect((await http().get(`/products/slug/${slug}`)).status).toBe(200);
  });

  it('reads "?flag=false" as false, not as true', async () => {
    const total = async (path: string) => {
      const res = await http().get(path).set(auth());
      expect(res.status).toBe(200);
      return res.body.data.pagination.total as number;
    };
    // Admin catalog: "false" must mean the same as leaving the flag out.
    expect(await total('/products/admin/all?archivedOnly=false')).toBe(
      await total('/products/admin/all'),
    );
    expect(await total('/products/admin/all?lowStockOnly=false')).toBe(
      await total('/products/admin/all'),
    );
    // Admin review list's public twin: the shop's review filters.
    const product = await http()
      .post('/products')
      .set(auth())
      .send({
        name: `${TAG} flag tee`,
        price: 900,
        stockQuantity: 2,
        sku: `${TAG}-flag`,
        productType: ProductType.READY_MADE,
      });
    const reviews = async (q: string) => {
      const res = await http().get(
        `/reviews/product/${product.body.data.id as string}${q}`,
      );
      expect(res.status).toBe(200);
      return JSON.stringify(res.body.data);
    };
    expect(await reviews('?verifiedOnly=false&hasPhotos=false')).toBe(
      await reviews(''),
    );
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
    expect(JSON.stringify(res.body.message)).toMatch(
      /each image must be a full web address/,
    );
  });
});
