import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * Rate Limiting E2E Suite (QA-3.1b).
 *
 * Verifies that the guest checkout endpoint (/orders/guest-checkout),
 * decorated with @Throttle({ default: { limit: 20, ttl: 60_000 } }),
 * strictly enforces its 20 requests / 60s threshold and returns HTTP 429
 * Too Many Requests on the 21st request.
 */
describe('Rate Limiting E2E (QA-3.1b)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects the 21st request to /orders/guest-checkout with HTTP 429 Too Many Requests', async () => {
    const server = app.getHttpServer();

    // Fire 20 requests within the 60s window
    for (let i = 1; i <= 20; i++) {
      const res = await request(server)
        .post('/orders/guest-checkout')
        .send({});

      // The requests reach the controller/validation layer (400 Bad Request due to empty payload),
      // proving they passed the ThrottlerGuard and consumed 1 token each.
      expect(res.status).not.toBe(429);
    }

    // Fire the 21st request: must be blocked by ThrottlerGuard with 429
    const blockedRes = await request(server)
      .post('/orders/guest-checkout')
      .send({});

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.message).toMatch(/Too Many Requests|ThrottlerException/i);
  });
});
