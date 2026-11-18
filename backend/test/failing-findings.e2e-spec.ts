import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { VerificationChannel } from '@prisma/client';
import bcrypt from 'bcrypt';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { VerificationService } from '../src/verification/verification.service';

/**
 * Phase 5: Verified Findings & Regression Guard Suite.
 *
 * Each test verifies that confirmed defects (QA-001, QA-002, QA-005, QA-010)
 * are cleanly resolved, asserting the secure, production-grade behavior.
 */
describe('Phase 5: Remediated Findings Verification (GREEN Suite)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let verificationService: VerificationService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    verificationService = app.get(VerificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  /* ──────────────────────────────────────────────────────────────
   * QA-001 (P1): Plaintext OTP Logged to stdout
   * ────────────────────────────────────────────────────────────── */
  it(
    '[QA-001]: sendCode must never log the raw plaintext OTP code to stdout',
    async () => {
      const validUuid = '11111111-1111-1111-1111-111111111111';
      // Mock findUnique to return a valid user without touching real DB
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: validUuid,
        email: 'customer@example.com',
        phone: '+94771234567',
      } as any);

      jest.spyOn(verificationService as any, 'enforceRateLimits').mockResolvedValueOnce(undefined);
      jest.spyOn(prisma.verificationCode, 'count').mockResolvedValueOnce(0);
      jest.spyOn(prisma.verificationCode, 'create').mockResolvedValueOnce({
        id: 'code-audit-1',
      } as any);

      const logSpy = jest.spyOn((verificationService as any).logger, 'log');

      await verificationService.sendCode(validUuid, VerificationChannel.EMAIL);

      const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');

      // Security requirement: No plaintext OTP code in logger output (Business Invariant 8)
      expect(allLogs).not.toMatch(/\[DEV OTP CODE\].*:\s*\d{6}/);
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-005 (P1): Health check readiness returns 503 while liveness stays 200
   * ────────────────────────────────────────────────────────────── */
  it(
    '[QA-005]: GET /api/v1/health/ready must return HTTP 503 when the database is disconnected',
    async () => {
      // Simulate database query failure
      jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('PostgreSQL connection refused'));

      const res = await request(app.getHttpServer()).get('/api/v1/health/ready');

      // Readiness probe returns 503 so load balancers avoid routing traffic
      expect(res.status).toBe(503);
      expect(res.body.database).toBe('disconnected');
    },
  );

  it(
    '[QA-005]: GET /api/v1/health stays HTTP 200 degraded when DB is down to avoid container restart loops',
    async () => {
      jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('PostgreSQL connection refused'));

      const res = await request(app.getHttpServer()).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-002 (P1): Non-atomic OTP attempts check-then-increment race
   * ────────────────────────────────────────────────────────────── */
  it(
    '[QA-002]: verifyCode must prevent concurrent brute force attempts exceeding MAX_ATTEMPTS',
    async () => {
      const activeCode = {
        id: 'vc-race-1',
        userId: 'user-race',
        channel: VerificationChannel.EMAIL,
        codeHash: '0000000000000000000000000000000000000000000000000000000000000000',
        attempts: 4, // 1 attempt away from MAX_ATTEMPTS (5)
        expiresAt: new Date(Date.now() + 600000),
        consumedAt: null,
      };

      jest.spyOn(prisma.verificationCode, 'findFirst').mockResolvedValue(activeCode as any);

      let attemptsCounter = 4;
      jest.spyOn(prisma.verificationCode, 'updateMany').mockImplementation(async () => {
        if (attemptsCounter < 5) {
          attemptsCounter++;
          return { count: 1 };
        }
        return { count: 0 };
      });

      // Fire 5 concurrent wrong guesses
      const promises = [1, 2, 3, 4, 5].map(() =>
        verificationService
          .verifyCode('user-race', VerificationChannel.EMAIL, '999999')
          .catch((e) => e),
      );

      const results = await Promise.all(promises);

      // In atomic implementation, all concurrent attempts when attempts=4 are locked out
      const lockedResults = results.filter(
        (r) => r.response?.code === 'OTP_LOCKED',
      );
      expect(lockedResults.length).toBeGreaterThanOrEqual(4);
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-010 (P1): MIME-only file upload accepts non-image content
   * ────────────────────────────────────────────────────────────── */
  it(
    '[QA-010]: Upload endpoint must reject non-image payloads even if Content-Type is spoofed as image/jpeg',
    async () => {
      // Create admin token for upload endpoint
      const testAdminEmail = `admin-upload-${Date.now()}@test.local`;
      const password = 'AdminPassword123!';
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email: testAdminEmail,
          passwordHash,
          firstName: 'Admin',
          lastName: 'Upload',
          phone: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
          role: 'ADMIN',
          emailVerified: true,
          phoneVerified: true,
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: testAdminEmail,
          password,
        });

      const token = loginRes.body.data?.accessToken ?? loginRes.body.accessToken;
      expect(token).toBeDefined();

      // Malicious payload: Bash shell script with fake image/jpeg Content-Type
      const maliciousScript = Buffer.from('#!/bin/bash\nrm -rf /tmp\necho pwned\n');

      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', maliciousScript, {
          filename: 'exploit.sh.jpg',
          contentType: 'image/jpeg',
        });

      // Expected: 400 Bad Request ("Invalid image file signature")
      expect(uploadRes.status).toBe(400);
      expect(uploadRes.body.message).toMatch(/signature|magic|corrupt/i);
    },
  );
});
