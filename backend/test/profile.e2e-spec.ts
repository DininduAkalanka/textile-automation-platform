import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import type { Express } from 'express';
import { UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * A signed-in person can correct their own name (PATCH /auth/profile). Before
 * this, a name mistyped at registration or guest checkout ("Test", a typo)
 * greeted them forever and was printed on every invoice.
 */
describe('Update own name (PATCH /auth/profile)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const TAG = `profile-${Date.now()}`;
  const email = `${TAG}@example.test`;
  const PASSWORD = 'Profile#Pass1';
  let ipN = 1;
  const ip = () => `10.98.0.${ipN++}`;
  const http = () => request(app.getHttpServer());
  let token: string;

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

    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.CUSTOMER,
        emailVerified: true,
      },
    });
    const login = await http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip())
      .send({ identifier: email, password: PASSWORD });
    token = login.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await app.close();
  });

  const patch = (body: unknown, auth = true) => {
    const req = http().patch('/auth/profile').set('X-Forwarded-For', ip());
    return (auth ? req.set('Authorization', `Bearer ${token}`) : req).send(
      body as object,
    );
  };

  it('requires a signed-in user', async () => {
    await patch({ firstName: 'Nimal', lastName: 'Perera' }, false).expect(401);
  });

  it('saves the new name, tidies spaces, and /auth/me shows it', async () => {
    const res = await patch({
      firstName: '  Nimal  ',
      lastName: 'De   Silva',
    }).expect(200);
    expect(res.body.data).toMatchObject({
      firstName: 'Nimal',
      lastName: 'De Silva',
      email,
    });
    const me = await http()
      .get('/auth/me')
      .set('X-Forwarded-For', ip())
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data).toMatchObject({
      firstName: 'Nimal',
      lastName: 'De Silva',
    });
  });

  it('accepts names in Sinhala and Tamil, and apostrophes or hyphens', async () => {
    await patch({ firstName: 'නිමල්', lastName: 'பெரேரா' }).expect(200);
    await patch({ firstName: "D'Souza", lastName: 'Jean-Luc' }).expect(200);
  });

  it.each([
    ['digits', { firstName: 'Test1', lastName: 'User' }],
    ['markup', { firstName: '<b>Bob</b>', lastName: 'User' }],
    ['a blank name', { firstName: '   ', lastName: 'User' }],
    [
      'a name over 50 characters',
      { firstName: 'A'.repeat(51), lastName: 'User' },
    ],
  ])('rejects %s', async (_label, body) => {
    await patch(body).expect(400);
  });

  it('cannot change role or email through this endpoint', async () => {
    await patch({
      firstName: 'Nimal',
      lastName: 'Perera',
      role: 'ADMIN',
    }).expect(400);
    await patch({
      firstName: 'Nimal',
      lastName: 'Perera',
      email: 'other@example.test',
    }).expect(400);
    const stored = await prisma.user.findUnique({
      where: { email },
      select: { role: true, email: true },
    });
    expect(stored).toEqual({ role: UserRole.CUSTOMER, email });
  });

  it('a deactivated account cannot change its name', async () => {
    await prisma.user.update({ where: { email }, data: { isActive: false } });
    await patch({ firstName: 'Nimal', lastName: 'Perera' }).expect(401);
    await prisma.user.update({ where: { email }, data: { isActive: true } });
  });
});
