import { randomUUID } from 'crypto';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OrderStatus,
  ProductionStage,
  TaskStatus,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductionService } from '../src/production/production.service';

/**
 * Plan Session 6.1 acceptance criterion: "Pipeline endpoint returns in < 300ms
 * on 200 seeded tasks."
 *
 * A separate file from production.e2e-spec.ts on purpose. That suite seeds
 * through OrdersService — reservation, measurement validation, the works —
 * because it is testing BUSINESS RULES and needs the real path. This file is
 * testing a QUERY, and going through the order service 200 times would spend
 * most of its runtime on the thing NOT being measured. Rows are inserted
 * directly with Prisma so the seeding cost stays out of the number that matters.
 */
describe('Production pipeline performance (plan 6.1 AC)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let production: ProductionService;

  const TAG = `prodperf-${Date.now()}`;
  const TASK_COUNT = 200;

  let customerId: string;
  let productId: string;
  let taskIds: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    production = app.get(ProductionService);

    customerId = (
      await prisma.user.create({
        data: {
          email: `${TAG}@example.test`,
          passwordHash: 'not-a-real-hash',
          emailVerified: true,
          firstName: 'Perf',
          lastName: 'Tester',
          role: UserRole.CUSTOMER,
        },
      })
    ).id;

    productId = (
      await prisma.product.create({
        data: {
          name: `${TAG} uniform`,
          slug: `${TAG}-uniform`,
          sku: `${TAG}-uniform`,
          price: 1000,
          stockQuantity: 0,
        },
      })
    ).id;

    // One order per task, generated with client-side UUIDs so three createMany
    // calls can be wired together (order -> item -> task) without a round trip
    // per row. This is what makes seeding 200 rows take milliseconds rather than
    // minutes — going through Prisma's ORM API in a loop of individual .create()
    // calls would itself risk becoming slower than the thing being measured.
    const rows = Array.from({ length: TASK_COUNT }, (_, i) => ({
      orderId: randomUUID(),
      itemId: randomUUID(),
      taskId: randomUUID(),
      index: i,
    }));
    taskIds = rows.map((r) => r.taskId);

    await prisma.order.createMany({
      data: rows.map((r) => ({
        id: r.orderId,
        orderNumber: `PERF-${TAG}-${r.index}`,
        userId: customerId,
        subtotal: 1000,
        total: 1000,
        status: OrderStatus.CONFIRMED,
      })),
    });

    await prisma.orderItem.createMany({
      data: rows.map((r) => ({
        id: r.itemId,
        orderId: r.orderId,
        productId,
        quantity: 1,
        unitPrice: 1000,
        totalPrice: 1000,
      })),
    });

    // Every task PENDING at CUTTING — the heaviest column, and the state the
    // board is in immediately after a batch of orders is confirmed.
    await prisma.productionTask.createMany({
      data: rows.map((r) => ({
        id: r.taskId,
        orderId: r.orderId,
        orderItemId: r.itemId,
        stage: ProductionStage.CUTTING,
        status: TaskStatus.PENDING,
      })),
    });
  });

  afterAll(async () => {
    // order -> productionTask and order -> orderItem are both ON DELETE CASCADE,
    // so deleting the orders is sufficient to take the tasks and items with them.
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.user.delete({ where: { id: customerId } });
    await app.close();
  });

  it(`seeded exactly ${TASK_COUNT} tasks`, async () => {
    const count = await prisma.productionTask.count({
      where: { id: { in: taskIds } },
    });
    expect(count).toBe(TASK_COUNT);
  });

  it('returns the pipeline in under 300ms', async () => {
    // One warm-up call, unmeasured: the AC is about the query's own cost, not
    // about paying for Postgres's first-connection / plan-cache overhead on
    // whichever test happens to run first in the file.
    await production.getPipeline();

    const start = performance.now();
    const pipeline = await production.getPipeline();
    const elapsedMs = performance.now() - start;

    const seeded = pipeline.CUTTING.filter((t) => taskIds.includes(t.id));
    expect(seeded).toHaveLength(TASK_COUNT);

    // The plan's own DELIVER line asks for "test matrix output" — a number that
    // only exists inside a boolean assertion is not something anyone can point to.
    console.log(
      `  [perf] getPipeline() with ${TASK_COUNT}+ tasks on the floor: ${elapsedMs.toFixed(1)}ms`,
    );

    expect(elapsedMs).toBeLessThan(300);
  });
});
