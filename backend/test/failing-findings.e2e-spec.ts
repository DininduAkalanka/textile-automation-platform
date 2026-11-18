import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { VerificationChannel } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { VerificationService } from '../src/verification/verification.service';

/**
 * Phase 4: RED Tests for Confirmed P0/P1 Findings.
 *
 * Each test asserts the SECURE / EXPECTED behavior against the live application.
 * Because production code has NOT been modified (Phases 0-4 are strictly READ+TEST only),
 * these tests deterministically FAIL with clear assertion error output, proving the defects.
 */
describe('Phase 4: Confirmed Findings Verification (RED Tests)', () => {
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
  it.failing(
    'RED [QA-001]: sendCode must never log the raw plaintext OTP code to stdout',
    async () => {
      // Mock findUnique to return a valid user without touching real DB
      const userSpy = jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: 'user-audit-otp',
        email: 'customer@example.com',
        phone: '+94771234567',
      } as any);

      jest.spyOn(prisma.verificationCode, 'count').mockResolvedValueOnce(0);
      jest.spyOn(prisma.verificationCode, 'create').mockResolvedValueOnce({
        id: 'code-audit-1',
      } as any);

      const logSpy = jest.spyOn((verificationService as any).logger, 'log');

      await verificationService.sendCode('user-audit-otp', VerificationChannel.EMAIL);

      const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');

      // Security requirement: No plaintext OTP code in logger output (Business Invariant 8)
      // Line 79 of verification.service.ts logs: [DEV OTP CODE] EMAIL for customer@example.com: 123456
      // Therefore, this assertion fails on unpatched code.
      expect(allLogs).not.toMatch(/\[DEV OTP CODE\].*:\s*\d{6}/);
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-005 (P1): /health returns 200 on DB failure instead of 503
   * ────────────────────────────────────────────────────────────── */
  it.failing(
    'RED [QA-005]: GET /api/v1/health must return HTTP 503 when the database is disconnected',
    async () => {
      // Simulate database query failure
      jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('PostgreSQL connection refused'));

      const res = await request(app.getHttpServer()).get('/api/v1/health');

      // Orchestrators (Render, Docker, ALB) treat HTTP 200 as healthy.
      // Expected: HTTP 503 Service Unavailable when DB is down.
      // Current behavior: Returns HTTP 200 with { status: "degraded", database: "down" }.
      expect(res.status).toBe(503);
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-002 (P1): Non-atomic OTP attempts check-then-increment race
   * ────────────────────────────────────────────────────────────── */
  it.failing(
    'RED [QA-002]: verifyCode must prevent concurrent brute force attempts exceeding MAX_ATTEMPTS',
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

      // Mock findFirst returning attempts: 4 concurrently
      jest.spyOn(prisma.verificationCode, 'findFirst').mockResolvedValue(activeCode as any);
      let incrementCalls = 0;
      jest.spyOn(prisma.verificationCode, 'update').mockImplementation(async () => {
        incrementCalls++;
        return activeCode as any;
      });

      // Fire 5 concurrent wrong guesses
      const promises = [1, 2, 3, 4, 5].map(() =>
        verificationService
          .verifyCode('user-race', VerificationChannel.EMAIL, '999999')
          .catch((e) => e),
      );

      const results = await Promise.all(promises);

      // All 5 requests pass the non-atomic check (attempts >= 5) and increment calls reach 5,
      // allowing 9 total guesses instead of being strictly locked at 5.
      // Expected: Locked out immediately via atomic check or transaction lock.
      const lockedResults = results.filter(
        (r) => r.response?.code === 'OTP_LOCKED',
      );
      expect(lockedResults.length).toBeGreaterThanOrEqual(4);
    },
  );

  /* ──────────────────────────────────────────────────────────────
   * QA-010 (P1): MIME-only file upload accepts non-image content
   * ────────────────────────────────────────────────────────────── */
  it.failing(
    'RED [QA-010]: Upload endpoint must reject non-image payloads even if Content-Type is spoofed as image/jpeg',
    async () => {
      // Create admin token for upload endpoint
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      expect(adminUser).toBeDefined();

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: adminUser!.email,
          password: 'Admin@123456',
        });

      const token = loginRes.body.data?.accessToken;
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
      // Current behavior: uploads.controller.ts only inspects file.mimetype string from client header,
      // accepting the malicious script and returning HTTP 201 with saved URL.
      expect(uploadRes.status).toBe(400);
      expect(uploadRes.body.message).toMatch(/signature|magic|corrupt/i);
    },
  );
});
