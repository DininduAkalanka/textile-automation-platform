import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { GUEST_CHECKOUT_THROTTLE_AT_LOAD } from '../src/common/config/limits';

/**
 * Rate Limiting E2E Suite (QA-3.1b).
 *
 * Verifies that the guest checkout endpoint (/orders/guest-checkout) strictly
 * enforces its per-IP limit (GUEST_CHECKOUT_THROTTLE_LIMIT, default 10 per
 * minute since the QA P0-2 remediation tightened it from 20) and returns HTTP
 * 429 Too Many Requests on the next request.
 */
describe('Rate Limiting E2E (QA-3.1b)', () => {
  const LIMIT = GUEST_CHECKOUT_THROTTLE_AT_LOAD;

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

  it('rejects the request after the limit to /orders/guest-checkout with HTTP 429 Too Many Requests', async () => {
    const server = app.getHttpServer();

    // Fire LIMIT requests within the 60s window
    for (let i = 1; i <= LIMIT; i++) {
      const res = await request(server)
        .post('/orders/guest-checkout')
        .send({});

      // The requests reach the controller/validation layer (400 Bad Request due to empty payload),
      // proving they passed the ThrottlerGuard and consumed 1 token each.
      expect(res.status).not.toBe(429);
    }

    // Fire the (LIMIT + 1)th request: must be blocked by ThrottlerGuard with 429
    const blockedRes = await request(server)
      .post('/orders/guest-checkout')
      .send({});

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.message).toMatch(/Too Many Requests|ThrottlerException/i);
  });
});
