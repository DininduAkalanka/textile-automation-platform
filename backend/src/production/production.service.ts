import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  ProductType,
  ProductionStage,
  TaskStatus,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  assertTransition,
  orderStatusNotification,
} from '../orders/order.machine';
import {
  IllegalTaskTransition,
  TaskAction,
  TaskTransition,
  allowedActions,
  applyAction,
} from './production.machine';

type Tx = Prisma.TransactionClient;

/**
 * Decision D8: which order items actually enter the production pipeline.
 *
 * Typed against the enum rather than loose strings, so renaming a ProductType
 * breaks the build here instead of silently emptying the pipeline — a typo in a
 * string literal would mean uniforms quietly stop being made.
 */
const PRODUCTION_TYPES: readonly ProductType[] = [
  ProductType.UNIFORM,
  ProductType.CUSTOM,
];

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  // ─── ProductionTrigger (decision D8, FR-P1) ──────────────────────────────

  /**
   * Called when an order reaches CONFIRMED. Creates one CUTTING task per order
   * item that needs making — an item qualifies when its product requires
   * measurements or is a UNIFORM/CUSTOM build. Retail fabric and ready-made
   * stock never enter the pipeline.
   *
   * Runs inside the caller's transaction (the same one that deducted stock), so
   * a confirmed order and its tasks are created together or not at all.
   *
   * IDEMPOTENT. The payment webhook can be redelivered and confirmOrder is
   * deliberately re-entrant, so this must not create a second set of tasks. It
   * returns 0 if the order already has any.
   */
  async createTasksForOrder(tx: Tx, orderId: string): Promise<number> {
    const existing = await tx.productionTask.count({ where: { orderId } });
    if (existing > 0) return 0;

    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });

    const productionItems = items.filter(
      (item) =>
        item.product.requiresMeasurement ||
        PRODUCTION_TYPES.includes(item.product.productType),
    );

    if (productionItems.length === 0) return 0;

    // One task per ITEM, not per unit: three identical shirts on one line are
    // cut and stitched together, so they are one job on the floor.
    await tx.productionTask.createMany({
      data: productionItems.map((item) => ({
        orderId,
        orderItemId: item.id,
        stage: ProductionStage.CUTTING,
        status: TaskStatus.PENDING,
      })),
    });

    return productionItems.length;
  }

  /**
   * True when an order has no production items at all (retail only). Such orders
   * skip the pipeline: CONFIRMED → COMPLETED when the admin fulfils them.
   */
  async isFulfilmentOnly(orderId: string): Promise<boolean> {
    const count = await this.prisma.productionTask.count({
      where: { orderId },
    });
    return count === 0;
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  /** Admin pipeline board, grouped by stage (plan Session 6.2). */
  async getPipeline() {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        // A finished QC task has left the floor; it would only clutter the board.
        NOT: { stage: ProductionStage.QUALITY_CHECK, status: TaskStatus.DONE },
      },
      include: {
        order: { select: { orderNumber: true, createdAt: true } },
        orderItem: {
          select: {
            quantity: true,
            measurements: true,
            product: { select: { name: true, productType: true } },
          },
        },
        worker: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // oldest first: the floor works a queue
    });

    const shaped = tasks.map((task) => this.shape(task));

    return {
      // Keys are the board's four columns, always present even when empty so the
      // UI never has to guess.
      CUTTING: shaped.filter((t) => t.stage === ProductionStage.CUTTING),
      STITCHING: shaped.filter((t) => t.stage === ProductionStage.STITCHING),
      FINISHING: shaped.filter((t) => t.stage === ProductionStage.FINISHING),
      QUALITY_CHECK: shaped.filter(
        (t) => t.stage === ProductionStage.QUALITY_CHECK,
      ),
    };
  }

  /**
   * A worker's own queue, plus what they finished today (plan Session 6.2, FR-P4).
   *
   * "Completed" only ever means one thing in this schema: `endTime` is set. Look
   * at the machine (production.machine.ts) — `finishes: true` is returned by
   * exactly one action, `qc_pass`. `complete` at CUTTING/STITCHING/FINISHING sets
   * status DONE but leaves `endTime` null, because the task is done with THAT
   * stage, not done for good — it is still awaiting `advance` and still belongs in
   * the queue. So "completed today" is not a second concept bolted on for morale;
   * it is the one place `endTime` was already meaningful, split out and dated.
   *
   * "Today" is computed by Postgres (`date_trunc('day', now())`), not Node, for
   * the same reason the dashboard's `ordersToday` is: the DB is the one clock the
   * whole system agrees on, and comparing a JS-local midnight against UTC-stored
   * timestamps is how "today" quietly becomes "today, unless the server and the
   * browser disagree about time zones."
   */
  async getMyTasks(userId: string) {
    const worker = await this.prisma.worker.findUnique({ where: { userId } });
    if (!worker) {
      throw new NotFoundException(
        'No worker profile is linked to this account',
      );
    }

    const include = {
      order: { select: { orderNumber: true, createdAt: true } },
      orderItem: {
        select: {
          quantity: true,
          measurements: true,
          product: { select: { name: true, productType: true } },
        },
      },
      worker: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    } as const;

    const [{ today }] = await this.prisma.$queryRaw<Array<{ today: Date }>>`
      SELECT date_trunc('day', now()) AS today`;

    const [queue, completedToday] = await Promise.all([
      this.prisma.productionTask.findMany({
        where: {
          assignedWorkerId: worker.id,
          NOT: {
            stage: ProductionStage.QUALITY_CHECK,
            status: TaskStatus.DONE,
          },
        },
        include,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productionTask.findMany({
        where: {
          assignedWorkerId: worker.id,
          stage: ProductionStage.QUALITY_CHECK,
          status: TaskStatus.DONE,
          endTime: { gte: today },
        },
        include,
        orderBy: { endTime: 'desc' },
      }),
    ]);

    return {
      queue: queue.map((task) => this.shape(task)),
      completedToday: completedToday.map((task) => this.shape(task)),
    };
  }

  /** Workers available for assignment (the admin's searchable select). */
  async getWorkers() {
    const workers = await this.prisma.worker.findMany({
      where: { isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return workers.map((worker) => ({
      id: worker.id,
      name: `${worker.user.firstName} ${worker.user.lastName}`.trim(),
      email: worker.user.email ?? '', // email is now nullable on User
      specialization: worker.specialization,
    }));
  }

  // ─── Writes ──────────────────────────────────────────────────────────────

  /** BR5: a task must be assigned to a worker before it can be started. */
  async assign(taskId: string, workerId: string) {
    const [task, worker] = await Promise.all([
      this.prisma.productionTask.findUnique({ where: { id: taskId } }),
      this.prisma.worker.findUnique({ where: { id: workerId } }),
    ]);

    if (!task) throw new NotFoundException('Task not found');
    if (!worker) throw new NotFoundException('Worker not found');
    if (!worker.isActive) {
      throw new BadRequestException('That worker is no longer active');
    }

    // Reassigning mid-job would orphan the work already done and lose the
    // start_time; finish or fail it first.
    if (task.status === TaskStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot reassign a task that is already in progress',
      );
    }

    await this.prisma.productionTask.update({
      where: { id: taskId },
      data: { assignedWorkerId: workerId },
    });

    return this.findOne(taskId);
  }

  /**
   * Drives a task through the machine and, in the SAME transaction, advances the
   * order if the task's move changed the order's overall state.
   *
   * @param userId  the caller
   * @param role    ADMIN may act on any task; WORKER only on their own (FR-P4)
   */
  async act(
    taskId: string,
    action: TaskAction,
    userId: string,
    role: UserRole,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.productionTask.findUnique({
        where: { id: taskId },
        include: { worker: true },
      });
      if (!task) throw new NotFoundException('Task not found');

      // Ownership: a worker may only touch their own tasks. Checked here rather
      // than in a guard because it depends on the row, not just the role.
      if (role === UserRole.WORKER) {
        const worker = await tx.worker.findUnique({ where: { userId } });
        if (!worker || task.assignedWorkerId !== worker.id) {
          throw new ForbiddenException('That task is not assigned to you');
        }
      }

      // BR5 — the rule the whole module exists to protect.
      if (action === 'start' && !task.assignedWorkerId) {
        throw new BadRequestException(
          'BR5: a task must be assigned to a worker before it can be started',
        );
      }

      let next: TaskTransition;
      try {
        next = applyAction(action, { stage: task.stage, status: task.status });
      } catch (error) {
        if (error instanceof IllegalTaskTransition) {
          // 422, not 400: the request is well-formed, the state just forbids it.
          throw new UnprocessableEntityException(error.message);
        }
        throw error;
      }

      if (next.requiresNote && !note?.trim()) {
        throw new BadRequestException(
          'A note explaining the failure is required when quality control rejects a task',
        );
      }

      await tx.productionTask.update({
        where: { id: taskId },
        data: {
          stage: next.stage,
          status: next.status,
          ...(next.starts && !task.startTime ? { startTime: new Date() } : {}),
          ...(next.finishes ? { endTime: new Date() } : {}),
          // A QC note is the record of why; clear it once the task moves on, so a
          // stale failure note never haunts a passing task.
          ...(note?.trim()
            ? { note: note.trim() }
            : next.finishes
              ? { note: null }
              : {}),
        },
      });

      await this.syncOrderStatus(tx, task.orderId, userId);

      return this.findOne(taskId, tx);
    });
  }

  // ─── Order auto-advance (plan Session 6.1, task 4) ───────────────────────

  /**
   * Derives the order's status from its tasks and moves it if it changed.
   *
   * The order status is never hand-set anywhere in this module — it is a pure
   * function of where the work actually is:
   *
   *   any task started            → IN_PRODUCTION
   *   every task reached QC       → QUALITY_CHECK
   *   every task DONE at QC       → COMPLETED
   *
   * Derived rather than incremented, so a QC failure (which drags a task back to
   * FINISHING) correctly pulls the order back from QUALITY_CHECK to
   * IN_PRODUCTION — an increment-only design would leave the order claiming it
   * was being inspected while a worker re-stitched it.
   *
   * The computed target is validated through order.machine.ts's canTransition()
   * before it is written — the SAME graph orders.service.ts's admin actions use.
   * That is what makes "never hand-set" true rather than aspirational: if this
   * function's derivation logic and the graph ever disagreed, assertTransition()
   * throws instead of silently writing a status the graph forbids. It used to just
   * write it — which is exactly how the QUALITY_CHECK→IN_PRODUCTION move went
   * unnoticed for as long as it did.
   */
  private async syncOrderStatus(tx: Tx, orderId: string, changedBy: string) {
    const [order, tasks] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId } }),
      tx.productionTask.findMany({ where: { orderId } }),
    ]);

    if (!order || tasks.length === 0) return;

    // A cancelled or delivered order is out of the pipeline's hands.
    const TERMINAL: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
    ];
    if (TERMINAL.includes(order.status)) return;

    const allDone = tasks.every(
      (t) =>
        t.stage === ProductionStage.QUALITY_CHECK &&
        t.status === TaskStatus.DONE,
    );
    const allAtQc = tasks.every(
      (t) => t.stage === ProductionStage.QUALITY_CHECK,
    );
    const anyStarted = tasks.some(
      (t) => t.status !== TaskStatus.PENDING || t.startTime !== null,
    );

    let target: OrderStatus | null = null;
    if (allDone) target = OrderStatus.COMPLETED;
    else if (allAtQc) target = OrderStatus.QUALITY_CHECK;
    else if (anyStarted) target = OrderStatus.IN_PRODUCTION;

    if (!target || target === order.status) return;

    // Not a duplicate of the branches above: THIS is what makes it impossible for
    // this function's own logic to drift from the graph everyone else uses. If a
    // future edit to allDone/allAtQc/anyStarted ever computed a target the shared
    // machine disagrees with, this throws — loudly, in the transaction that made
    // the mistake — rather than writing a status nothing else would recognise as
    // reachable.
    assertTransition(order.status, target);

    await tx.order.update({
      where: { id: orderId },
      data: { status: target },
    });

    // Every transition is on the customer's tracking timeline (D4).
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: target,
        changedBy,
        note: 'Automatic — production progress',
      },
    });

    // Plan 7.1 task 4: EVERY order status change notifies the customer, not just
    // the ones an admin's click causes. Before this line, a customer who ordered
    // a uniform heard "confirmed" and then NOTHING until someone hit "Deliver" —
    // no "in production", no "being inspected", no "ready" — because those three
    // transitions are entirely driven from here, never from orders.service.ts.
    // The COPY is shared (order.machine.ts's orderStatusNotification, the same
    // function orders.service.ts calls); only the WRITE is duplicated, four
    // lines, because notifyStatus() is private to OrdersService and this module
    // has no business reaching into it.
    const copy = orderStatusNotification(target, order.orderNumber);
    if (copy) {
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order.status_changed',
          title: copy.title,
          body: copy.body,
        },
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  async findOne(taskId: string, client: Tx | PrismaService = this.prisma) {
    const task = await client.productionTask.findUnique({
      where: { id: taskId },
      include: {
        order: { select: { orderNumber: true, createdAt: true } },
        orderItem: {
          select: {
            quantity: true,
            measurements: true,
            product: { select: { name: true, productType: true } },
          },
        },
        worker: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return this.shape(task);
  }

  /** One shape for every task the API returns, so the UI never branches on source. */
  private shape(task: {
    id: string;
    orderId: string;
    stage: ProductionStage;
    status: TaskStatus;
    note: string | null;
    startTime: Date | null;
    endTime: Date | null;
    createdAt: Date;
    order: { orderNumber: string; createdAt: Date };
    orderItem: {
      quantity: number;
      measurements: Prisma.JsonValue;
      product: { name: string; productType: ProductType };
    };
    worker: {
      id: string;
      user: { firstName: string; lastName: string };
    } | null;
  }) {
    return {
      id: task.id,
      orderId: task.orderId,
      orderNumber: task.order.orderNumber,
      stage: task.stage,
      status: task.status,
      product: task.orderItem.product.name,
      productType: task.orderItem.product.productType,
      quantity: task.orderItem.quantity,
      // The whole reason BR3 exists: the floor needs these to cut the cloth.
      measurements: task.orderItem.measurements,
      worker: task.worker
        ? {
            id: task.worker.id,
            name: `${task.worker.user.firstName} ${task.worker.user.lastName}`.trim(),
          }
        : null,
      note: task.note,
      startTime: task.startTime,
      endTime: task.endTime,
      createdAt: task.createdAt,
      /** Hours since the task was created — drives the board's ageing indicator. */
      ageHours: Math.floor(
        (Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60),
      ),
      /**
       * Exactly what the caller may do to THIS task right now, so the UI can
       * render its buttons from one source of truth and never offer a move the
       * API would then refuse.
       *
       * The machine alone is not enough: it knows the states, not the row, so it
       * would happily offer `start` on an unassigned task — which act() then
       * rejects under BR5. Applying BR5 here keeps the machine pure while making
       * this list honest.
       */
      allowedActions: allowedActions({
        stage: task.stage,
        status: task.status,
      }).filter((action) => action !== 'start' || task.worker !== null),
    };
  }
}
