import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MovementType,
  OrderStatus,
  ProductType,
  ProductionStage,
  TaskStatus,
  UserRole,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductionService } from '../src/production/production.service';

/**
 * Phase 6 end-to-end (FR-P1..P5, BR5, decision D8).
 *
 * The chain this proves is the whole point of the module:
 *
 *   pay for a uniform → tasks appear → assign → work → QC → order COMPLETED
 *
 * and the things that must NOT happen: retail items entering the pipeline, a
 * task starting without an assignee, a worker touching someone else's job, or a
 * redelivered webhook cutting the same garment twice.
 */
describe('Production pipeline (Phase 6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let production: ProductionService;

  const TAG = `prod-${Date.now()}`;

  let customerId: string;
  let adminId: string;
  let workerUserId: string;
  let workerId: string;
  let otherWorkerUserId: string;
  let otherWorkerId: string;

  let uniformId: string;
  let uniform2Id: string;
  let retailId: string;

  const address = {
    fullName: 'Nimal Perera',
    addressLine1: '12 Galle Road',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00300',
    country: 'LK',
  };

  const measurements = {
    personName: 'Nimal Perera',
    values: {
      chest: 76,
      waist: 66,
      shoulder: 36,
      sleeveLength: 46,
      shirtLength: 60,
      trouserWaist: 66,
      hip: 80,
      trouserLength: 90,
    },
  };

  async function seedProduct(
    label: string,
    productType: ProductType,
    requiresMeasurement: boolean,
  ) {
    const product = await prisma.product.create({
      data: {
        name: `Prod ${label}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: 3000,
        stockQuantity: 50,
        productType,
        requiresMeasurement,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: 50,
        quantityReserved: 0,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: MovementType.INITIAL,
        quantityChange: 50,
      },
    });

    return product.id;
  }

  async function makeUser(suffix: string, role: UserRole) {
    const user = await prisma.user.create({
      data: {
        email: `${TAG}-${suffix}@example.test`,
        passwordHash: 'not-a-real-hash',
        firstName: suffix,
        lastName: 'Tester',
        role,
      },
    });
    return user.id;
  }

  /** Place an order and confirm it, which is what fires the ProductionTrigger. */
  async function placeAndConfirm(
    items: Array<{
      productId: string;
      quantity: number;
      measurements?: Record<string, unknown>;
    }>,
  ) {
    const order = await orders.create(customerId, {
      items,
      shippingAddress: address,
    });
    await orders.confirmOrder(order.id, adminId);
    return order.id;
  }

  const tasksOf = (orderId: string) =>
    prisma.productionTask.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

  const statusOf = async (orderId: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
    production = app.get(ProductionService);

    customerId = await makeUser('customer', UserRole.CUSTOMER);
    adminId = await makeUser('admin', UserRole.ADMIN);
    workerUserId = await makeUser('worker', UserRole.WORKER);
    otherWorkerUserId = await makeUser('worker2', UserRole.WORKER);

    workerId = (
      await prisma.worker.create({
        data: { userId: workerUserId, specialization: ProductionStage.CUTTING },
      })
    ).id;
    otherWorkerId = (
      await prisma.worker.create({ data: { userId: otherWorkerUserId } })
    ).id;

    uniformId = await seedProduct('uniform', ProductType.UNIFORM, true);
    uniform2Id = await seedProduct('uniform2', ProductType.UNIFORM, true);
    retailId = await seedProduct('retail', ProductType.READY_MADE, false);
  });

  afterAll(async () => {
    // Movements before orders: the FK is ON DELETE RESTRICT so an order's
    // stock history cannot be silently erased with it (20260712100000).
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: TAG } },
    });
    await app.close();
  });

  // ─── D8: who enters the pipeline ────────────────────────────────────────

  describe('ProductionTrigger (decision D8)', () => {
    it('creates a CUTTING task when a uniform order is confirmed', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);

      const tasks = await tasksOf(orderId);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        stage: ProductionStage.CUTTING,
        status: TaskStatus.PENDING,
        assignedWorkerId: null, // unassigned until an admin says otherwise
      });
    });

    it('creates NO task for a retail-only order — fabric is not tailored', async () => {
      const orderId = await placeAndConfirm([
        { productId: retailId, quantity: 2 },
      ]);

      expect(await tasksOf(orderId)).toHaveLength(0);
      expect(await production.isFulfilmentOnly(orderId)).toBe(true);
      // No tasks means no pipeline: the order stays CONFIRMED until fulfilled.
      expect(await statusOf(orderId)).toBe(OrderStatus.CONFIRMED);
    });

    it('creates a task for the uniform ONLY in a mixed order', async () => {
      const orderId = await placeAndConfirm([
        { productId: retailId, quantity: 1 },
        { productId: uniformId, quantity: 1, measurements },
      ]);

      const tasks = await tasksOf(orderId);
      expect(tasks).toHaveLength(1);

      const item = await prisma.orderItem.findUniqueOrThrow({
        where: { id: tasks[0].orderItemId },
      });
      expect(item.productId).toBe(uniformId);
    });

    /**
     * The webhook can be redelivered and confirmOrder is deliberately
     * re-entrant. A second task set would mean the same garment is cut twice.
     */
    it('is idempotent — a redelivered confirmation cuts nothing twice', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      expect(await tasksOf(orderId)).toHaveLength(1);

      await orders.confirmOrder(orderId, adminId);
      await orders.confirmOrder(orderId, adminId);

      expect(await tasksOf(orderId)).toHaveLength(1);
    });

    it('carries the BR3 measurements onto the task the floor reads', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      const shaped = await production.findOne(task.id);
      expect(shaped.measurements).toMatchObject({
        personName: 'Nimal Perera',
        values: { chest: 76, trouserLength: 90 },
      });
    });
  });

  // ─── BR5 + ownership ────────────────────────────────────────────────────

  describe('BR5: a task must be assigned before it can be started', () => {
    it('refuses to start an unassigned task', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      await expect(
        production.act(task.id, 'start', adminId, UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * allowedActions is what the UI renders its buttons from. If it offered
     * `start` on an unassigned task, the board would show a button that act()
     * then refuses under BR5 — the exact "offer a move the API rejects" bug the
     * field exists to prevent.
     */
    it('does not OFFER start on an unassigned task', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      const unassigned = await production.findOne(task.id);
      expect(unassigned.allowedActions).not.toContain('start');
      expect(unassigned.allowedActions).toEqual([]);

      const assigned = await production.assign(task.id, workerId);
      expect(assigned.allowedActions).toEqual(['start']);
    });

    it('starts once assigned', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      await production.assign(task.id, workerId);
      const started = await production.act(
        task.id,
        'start',
        workerUserId,
        UserRole.WORKER,
      );

      expect(started.status).toBe(TaskStatus.IN_PROGRESS);
      expect(started.startTime).not.toBeNull();
    });

    it('will not reassign a task that is already in progress', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      await production.assign(task.id, workerId);
      await production.act(task.id, 'start', workerUserId, UserRole.WORKER);

      await expect(production.assign(task.id, otherWorkerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('a worker may only touch their own tasks', () => {
    it('refuses another worker’s task', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      await production.assign(task.id, workerId);

      await expect(
        production.act(task.id, 'start', otherWorkerUserId, UserRole.WORKER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets an admin act on any task', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      await production.assign(task.id, workerId);
      const started = await production.act(
        task.id,
        'start',
        adminId,
        UserRole.ADMIN,
      );

      expect(started.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('shows a worker only their own queue', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      const mine = await production.getMyTasks(workerUserId);
      const theirs = await production.getMyTasks(otherWorkerUserId);

      expect(mine.queue.map((t) => t.id)).toContain(task.id);
      expect(theirs.queue.map((t) => t.id)).not.toContain(task.id);
    });
  });

  describe('getMyTasks — queue vs completed today (plan Session 6.2, FR-P4)', () => {
    /** Drive a task all the way through QC to completion (qc_pass). */
    async function driveToCompletion(taskId: string) {
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // STITCHING
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // FINISHING
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // QUALITY_CHECK
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'qc_pass', adminId, UserRole.ADMIN);
    }

    it('moves a qc_pass task out of the queue and into completedToday', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await driveToCompletion(task.id);

      const { queue, completedToday } = await production.getMyTasks(workerUserId);
      expect(queue.map((t) => t.id)).not.toContain(task.id);
      expect(completedToday.map((t) => t.id)).toContain(task.id);
    });

    it('does not count a task completed on an earlier day as completed today', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await driveToCompletion(task.id);

      // Backdated exactly as if this had finished yesterday — "today" is a
      // property of endTime, not of when the test happens to run.
      await prisma.productionTask.update({
        where: { id: task.id },
        data: { endTime: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const { completedToday } = await production.getMyTasks(workerUserId);
      expect(completedToday.map((t) => t.id)).not.toContain(task.id);
    });
  });

  // ─── Order auto-advance ─────────────────────────────────────────────────

  describe('the order follows the work, and is never hand-set', () => {
    /** Drive a task from CUTTING/PENDING to QC/PENDING. */
    async function workToQc(taskId: string) {
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // STITCHING
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // FINISHING
      await production.act(taskId, 'start', adminId, UserRole.ADMIN);
      await production.act(taskId, 'complete', adminId, UserRole.ADMIN);
      await production.act(taskId, 'advance', adminId, UserRole.ADMIN); // QC
    }

    it('moves CONFIRMED → IN_PRODUCTION the moment the first task starts', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);

      expect(await statusOf(orderId)).toBe(OrderStatus.CONFIRMED);

      await production.assign(task.id, workerId);
      await production.act(task.id, 'start', workerUserId, UserRole.WORKER);

      expect(await statusOf(orderId)).toBe(OrderStatus.IN_PRODUCTION);
    });

    it('runs a single-item order all the way to COMPLETED', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await workToQc(task.id);
      expect(await statusOf(orderId)).toBe(OrderStatus.QUALITY_CHECK);

      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'qc_pass', adminId, UserRole.ADMIN);

      expect(await statusOf(orderId)).toBe(OrderStatus.COMPLETED);
    });

    /**
     * The rule that makes the status DERIVED rather than incremented: two
     * uniforms, one finished, one still being cut. The order must not claim to
     * be in quality check while half of it is on the cutting table.
     */
    it('waits for EVERY task before advancing a multi-item order', async () => {
      // Two DIFFERENT uniforms, because OrdersService.create currently rejects
      // the same product twice in one order (see the KNOWN LIMITATION note at
      // the foot of this file — ordering the same uniform for two children with
      // different measurements is not yet expressible).
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
        { productId: retailId, quantity: 1 },
        { productId: uniform2Id, quantity: 2, measurements },
      ]);

      const tasks = await tasksOf(orderId);
      // Two uniform lines, one retail line -> two tasks.
      expect(tasks).toHaveLength(2);

      for (const task of tasks) await production.assign(task.id, workerId);

      await workToQc(tasks[0].id);
      // One at QC, one untouched: the order is in production, not quality check.
      expect(await statusOf(orderId)).toBe(OrderStatus.IN_PRODUCTION);

      await workToQc(tasks[1].id);
      expect(await statusOf(orderId)).toBe(OrderStatus.QUALITY_CHECK);

      for (const task of tasks) {
        await production.act(task.id, 'start', adminId, UserRole.ADMIN);
        await production.act(task.id, 'qc_pass', adminId, UserRole.ADMIN);
      }

      expect(await statusOf(orderId)).toBe(OrderStatus.COMPLETED);
    });

    /**
     * A QC failure drags one task back to FINISHING. The order must follow it
     * back — an increment-only design would leave the order claiming it was
     * being inspected while a worker re-stitched it.
     */
    it('pulls the order BACK from QUALITY_CHECK when QC fails', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await workToQc(task.id);
      expect(await statusOf(orderId)).toBe(OrderStatus.QUALITY_CHECK);

      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(
        task.id,
        'qc_fail',
        adminId,
        UserRole.ADMIN,
        'Left sleeve is 2cm short',
      );

      expect(await statusOf(orderId)).toBe(OrderStatus.IN_PRODUCTION);

      const reworked = await production.findOne(task.id);
      expect(reworked.stage).toBe(ProductionStage.FINISHING);
      expect(reworked.status).toBe(TaskStatus.PENDING);
      expect(reworked.note).toBe('Left sleeve is 2cm short');
    });

    it('demands a note when QC rejects a garment', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await workToQc(task.id);
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);

      await expect(
        production.act(task.id, 'qc_fail', adminId, UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes every automatic move onto the customer’s tracking timeline', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await workToQc(task.id);
      await production.act(task.id, 'start', adminId, UserRole.ADMIN);
      await production.act(task.id, 'qc_pass', adminId, UserRole.ADMIN);

      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      const path = history.map((h) => h.toStatus);
      expect(path).toEqual([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.QUALITY_CHECK,
        OrderStatus.COMPLETED,
      ]);
    });
  });

  describe('illegal task actions are refused', () => {
    it('cannot complete work that was never started', async () => {
      const orderId = await placeAndConfirm([
        { productId: uniformId, quantity: 1, measurements },
      ]);
      const [task] = await tasksOf(orderId);
      await production.assign(task.id, workerId);

      await expect(
        production.act(task.id, 'complete', adminId, UserRole.ADMIN),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('the pipeline board', () => {
    it('groups tasks into the four columns', async () => {
      const pipeline = await production.getPipeline();

      expect(Object.keys(pipeline).sort()).toEqual([
        'CUTTING',
        'FINISHING',
        'QUALITY_CHECK',
        'STITCHING',
      ]);
      expect(Array.isArray(pipeline.CUTTING)).toBe(true);
    });
  });

  /**
   * KNOWN LIMITATION — documented, not accepted.
   *
   * OrdersService.create compares `products.length !== productIds.length` after
   * a findMany, which dedupes. So the SAME product cannot appear twice in one
   * order — and the obvious textile case is exactly that: two school uniforms of
   * the same product, for two children, with DIFFERENT measurements.
   *
   * Today a parent must place two separate orders. Fixing it means keying cart
   * lines by (productId + measurements) rather than productId, and letting the
   * order carry duplicate productIds — a real change to the cart and the order
   * shape, so it is deliberately not smuggled into this session.
   *
   * This test asserts the CURRENT behaviour so the day someone fixes it, this
   * fails and forces them to notice the decision.
   */
  describe('known limitation: same product twice in one order', () => {
    it('is currently rejected — two children, one uniform product, needs two orders', async () => {
      await expect(
        orders.create(customerId, {
          items: [
            {
              productId: uniformId,
              quantity: 1,
              measurements: { ...measurements, personName: 'Child One' },
            },
            {
              productId: uniformId,
              quantity: 1,
              measurements: { ...measurements, personName: 'Child Two' },
            },
          ],
          shippingAddress: address,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
