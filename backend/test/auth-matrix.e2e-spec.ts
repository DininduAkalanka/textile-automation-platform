import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Data-Driven Authorization Matrix Suite (QA-3.1).
 *
 * Verifies role-based access control across every role in the system:
 * [Unauthenticated, CUSTOMER, WORKER, MANAGER, ADMIN]
 * evaluated against representative endpoints spanning public, customer, worker, and admin-only surfaces.
 */
describe('Authorization Matrix E2E (QA-3.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const TAG = `authmatrix-${Date.now()}`;

  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  const roles = [
    UserRole.CUSTOMER,
    UserRole.WORKER,
    UserRole.MANAGER,
    UserRole.ADMIN,
  ];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Create a user and sign a token for each role
    for (const role of roles) {
      const email = `${TAG}-${role.toLowerCase()}@example.test`;
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'dummy-hash',
          firstName: role,
          lastName: 'User',
          role,
          emailVerified: true,
        },
      });

      userIds[role] = user.id;

      if (role === UserRole.WORKER || role === UserRole.ADMIN) {
        await prisma.worker.create({
          data: {
            userId: user.id,
            isActive: true,
          },
        });
      }

      // Match payload signed by AuthService: { sub: user.id, email: user.email, role: user.role }
      tokens[role] = jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(userIds) } },
    });
    await app.close();
  });

  interface MatrixEndpoint {
    label: string;
    method: 'get' | 'post';
    path: string;
    expectedStatuses: {
      UNAUTHENTICATED: number;
      CUSTOMER: number;
      WORKER: number;
      MANAGER: number;
      ADMIN: number;
    };
  }

  const endpoints: MatrixEndpoint[] = [
    {
      label: 'Admin-only orders listing (GET /orders/admin/all)',
      method: 'get',
      path: '/orders/admin/all',
      expectedStatuses: {
        UNAUTHENTICATED: 401,
        CUSTOMER: 403,
        WORKER: 403,
        MANAGER: 403,
        ADMIN: 200,
      },
    },
    {
      label: 'Admin-only production pipeline (GET /production/pipeline)',
      method: 'get',
      path: '/production/pipeline',
      expectedStatuses: {
        UNAUTHENTICATED: 401,
        CUSTOMER: 403,
        WORKER: 403,
        MANAGER: 403,
        ADMIN: 200,
      },
    },
    {
      label: 'Worker + Admin queue (GET /production/my-tasks)',
      method: 'get',
      path: '/production/my-tasks',
      expectedStatuses: {
        UNAUTHENTICATED: 401,
        CUSTOMER: 403,
        WORKER: 200,
        MANAGER: 403,
        ADMIN: 200,
      },
    },
    {
      label: 'Authenticated customer orders (GET /orders)',
      method: 'get',
      path: '/orders',
      expectedStatuses: {
        UNAUTHENTICATED: 401,
        CUSTOMER: 200,
        WORKER: 200,
        MANAGER: 200,
        ADMIN: 200,
      },
    },
    {
      label: 'Public products catalog (GET /products)',
      method: 'get',
      path: '/products',
      expectedStatuses: {
        UNAUTHENTICATED: 200,
        CUSTOMER: 200,
        WORKER: 200,
        MANAGER: 200,
        ADMIN: 200,
      },
    },
  ];

  describe.each(endpoints)('$label', (endpoint) => {
    it('enforces expected status for unauthenticated requests', async () => {
      const res = await request(app.getHttpServer())[endpoint.method](endpoint.path);
      expect(res.status).toBe(endpoint.expectedStatuses.UNAUTHENTICATED);
    });

    it.each(roles)('enforces expected status for role %s', async (role) => {
      const token = tokens[role];
      const res = await request(app.getHttpServer())
        [endpoint.method](endpoint.path)
        .set('Authorization', `Bearer ${token}`);

      const expected = endpoint.expectedStatuses[role as keyof typeof endpoint.expectedStatuses];
      expect(res.status).toBe(expected);
    });
  });
});
