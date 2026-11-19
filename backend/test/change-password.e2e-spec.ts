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
 * Pre-handover: a signed-in user can change their own password (there was no
 * way to do it before, so a shop owner could not replace a handed-over one).
 */
describe('Change password (POST /auth/change-password)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const TAG = `chpw-${Date.now()}`;
  const email = `${TAG}@example.test`;
  const OLD = 'Original#Pass1';
  const NEW = 'Brand-New#Pass2';
  let ipN = 1;
  const ip = () => `10.99.0.${ipN++}`;

  const http = () => request(app.getHttpServer());
  const refreshCookie = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refresh_token='))
      ?.split(';')[0];

  async function login(password: string) {
    return http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip())
      .send({ identifier: email, password });
  }

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
        passwordHash: await bcrypt.hash(OLD, 4),
        firstName: 'Owner',
        lastName: 'Tester',
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await app.close();
  });

  it('requires a signed-in user', async () => {
    const res = await http()
      .post('/auth/change-password')
      .set('X-Forwarded-For', ip())
      .send({ currentPassword: OLD, newPassword: NEW });
    expect(res.status).toBe(401);
  });

  it('refuses a wrong current password (400, counted towards lockout)', async () => {
    const token = (await login(OLD)).body.data.accessToken as string;
    const res = await http()
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ip())
      .send({ currentPassword: 'not-my-password', newPassword: NEW });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_CURRENT_PASSWORD');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.failedLoginAttempts).toBe(1);
  });

  it('refuses a new password identical to the current one', async () => {
    const token = (await login(OLD)).body.data.accessToken as string;
    const res = await http()
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ip())
      .send({ currentPassword: OLD, newPassword: OLD });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PASSWORD_UNCHANGED');
  });

  it('refuses a new password shorter than 8 characters', async () => {
    const token = (await login(OLD)).body.data.accessToken as string;
    const res = await http()
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', ip())
      .send({ currentPassword: OLD, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('changes the password, signs out other devices and keeps this one signed in', async () => {
    const otherDevice = refreshCookie(await login(OLD));
    const thisDevice = await login(OLD);
    expect(otherDevice).toBeDefined();

    const res = await http()
      .post('/auth/change-password')
      .set(
        'Authorization',
        `Bearer ${thisDevice.body.data.accessToken as string}`,
      )
      .set('X-Forwarded-For', ip())
      .send({ currentPassword: OLD, newPassword: NEW });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const freshCookie = refreshCookie(res);
    expect(freshCookie).toBeDefined();

    // The other device's session no longer works.
    const otherRefresh = await http()
      .post('/auth/refresh')
      .set('X-Forwarded-For', ip())
      .set('Cookie', otherDevice!);
    expect(otherRefresh.status).toBe(401);

    // Old password refused, new password accepted.
    expect((await login(OLD)).status).toBe(401);
    expect((await login(NEW)).status).toBe(201);

    // The lockout counter was reset by the successful change.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.failedLoginAttempts).toBe(0);
  });
});
