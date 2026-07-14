import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionService } from '../production/production.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { validateMeasurements } from './measurements.config';
import {
  OrderStatus,
  Prisma,
  UserRole,
  PaymentStatus,
  PaymentMethod,
} from '@prisma/client';
import {
  OrderAction,
  allowedOrderActions,
  assertTransition,
  canTransition,
  orderStatusNotification,
} from './order.machine';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private production: ProductionService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXL-${timestamp}-${random}`;
  }

  async create(userId: string, dto: CreateOrderDto) {
    // Validate all products exist and have sufficient stock
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products not found or inactive',
      );
    }

    // Check stock availability
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`,
        );
      }
    }

    // BR3 — custom orders require measurement data (doc 01 §7).
    //
    // Validated against the PRODUCT row, never against anything the client
    // asserts, so a tampered request cannot dodge the rule by mislabelling a
    // uniform as ready-made. Every failing line is reported at once rather than
    // one per round trip.
    const measurementErrors = dto.items.flatMap((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return validateMeasurements(
        product.name,
        product.productType,
        product.requiresMeasurement,
        item.measurements ?? null,
      );
    });

    if (measurementErrors.length > 0) {
      throw new BadRequestException(measurementErrors);
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const orderItems = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const totalPrice = product.price.mul(item.quantity);
      subtotal = subtotal.add(totalPrice);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        // Snapshotted onto the line, so a later edit to the customer's saved
        // measurements never rewrites what was actually cut and stitched.
        measurements: (item.measurements ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      };
    });

    const tax = subtotal.mul(0.0); // Configure tax rate as needed
    const shippingCost = new Prisma.Decimal(0); // Free shipping for now
    const total = subtotal.add(tax).add(shippingCost);

    // Create order with items in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          subtotal,
          tax,
          shippingCost,
          total,
          shippingAddress: dto.shippingAddress as any,
          billingAddress: (dto.billingAddress || dto.shippingAddress) as any,
          notes: dto.notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // Reserve stock on the inventory ledger (D3). reserve() is race-safe (a
      // guarded UPDATE) and writes a RESERVE movement; the earlier JS check is
      // just a fast, friendly pre-validation. Stock is not deducted until the
      // order is confirmed (SALE) — until then it is only reserved.
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId);
        await this.inventory.reserve(
          tx,
          item.productId,
          item.quantity,
          newOrder.id,
          product?.name,
        );
      }

      // Opening transition (null -> PENDING) for the tracking timeline (D4).
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
        },
      });

      return newOrder;
    });

    return order;
  }

  async findUserOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: { product: true },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * IDOR-safe by construction: a non-admin read is scoped to `userId` in the
   * WHERE clause itself, so a mismatched owner comes back as "not found", not
   * "forbidden" — a 403 would confirm the order exists and belongs to someone
   * else, which is itself a small leak (doc 09 §2).
   *
   * `statusHistory` and `productionTasks` are attached for EVERY caller (the
   * customer tracking stepper and the admin timeline widget read the same
   * rows). `adminActions` and each history entry's resolved `changedByName`
   * are admin-only — see orders.e2e-spec.ts's "never attaches adminActions to
   * a customer-facing read".
   */
  async findById(
    id: string,
    opts: { userId?: string; isAdmin?: boolean } = {},
  ) {
    const where: Prisma.OrderWhereInput = { id };
    if (!opts.isAdmin && opts.userId) {
      where.userId = opts.userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: {
          include: { product: true },
        },
        payment: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        productionTasks: {
          include: {
            worker: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const productionTasks = order.productionTasks.map((t) => ({
      id: t.id,
      stage: t.stage,
      status: t.status,
      orderItemId: t.orderItemId,
      worker: t.worker ? { user: t.worker.user } : null,
    }));

    // One return shape always, admin-gated only in VALUE (not in which keys
    // exist) — two structurally different return statements would give this
    // method a union return type, and TypeScript reports `adminActions` as
    // not existing at all on the branch that omits it, even behind an `!`.
    const statusHistory = opts.isAdmin
      ? await this.resolveChangedByNames(order.statusHistory)
      : order.statusHistory;
    const adminActions = opts.isAdmin
      ? this.computeAdminActions({
          status: order.status,
          hasProductionTasks: order.productionTasks.length > 0,
          payment: order.payment,
        })
      : undefined;

    return { ...order, productionTasks, statusHistory, adminActions };
  }

  /**
   * The three admin-driven verbs that go through the shared graph
   * (order.machine.ts), plus the customer's own PENDING self-cancel.
   *
   * `actor.role` decides two independent things: whether the WHERE clause is
   * scoped to `actor.id` (IDOR), and whether a non-PENDING order is even
   * reachable at all (a customer may only cancel their own order before it is
   * confirmed — a garment may already be cut by then, and that call belongs
   * to an admin, not to the person who placed the order).
   */
  async cancel(
    orderId: string,
    actor: { id: string; role: UserRole },
    options: { acknowledgeRefund?: boolean; note?: string } = {},
  ) {
    const isAdmin = actor.role === UserRole.ADMIN;

    const order = await this.prisma.order.findFirst({
      where: isAdmin ? { id: orderId } : { id: orderId, userId: actor.id },
      include: { payment: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!isAdmin && order.status !== OrderStatus.PENDING) {
      throw new ForbiddenException(
        'Only an admin can cancel an order that has already been confirmed',
      );
    }

    if (!canTransition(order.status, OrderStatus.CANCELLED)) {
      throw new BadRequestException(
        `Cannot cancel an order that is already ${order.status.toLowerCase().replace('_', ' ')}`,
      );
    }

    if (
      order.payment?.status === PaymentStatus.COMPLETED &&
      !options.acknowledgeRefund
    ) {
      throw new BadRequestException(
        'This order is paid in full. Cancelling requires acknowledging that a refund must be issued manually — cancelling does not refund the customer automatically.',
      );
    }

    const refundDetail =
      order.payment?.status === PaymentStatus.COMPLETED
        ? 'A refund will be processed manually.'
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        if (order.status === OrderStatus.PENDING) {
          // Not yet sold — free the reservation.
          await this.inventory.release(
            tx,
            item.productId,
            item.quantity,
            orderId,
          );
        } else {
          // Already sold (CONFIRMED) — return units to available.
          await this.inventory.restock(
            tx,
            item.productId,
            item.quantity,
            orderId,
          );
        }
      }

      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedBy: actor.id,
          note: options.note,
        },
      });

      if (order.payment?.status === PaymentStatus.COMPLETED) {
        await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.REFUNDED },
        });
      } else if (order.payment?.status === PaymentStatus.PENDING) {
        // Nothing was ever collected — there is nothing to refund, only a
        // promise that will now never be honoured.
        await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.FAILED },
        });
      }

      const copy = orderStatusNotification(
        OrderStatus.CANCELLED,
        order.orderNumber,
        refundDetail,
      );
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

      return result;
    });

    return updated;
  }

  /**
   * Fulfillment-only orders (no production tasks) skip straight from
   * CONFIRMED to COMPLETED on an admin's click — an order WITH tasks reaches
   * COMPLETED automatically, driven by the production floor, and this button
   * must refuse rather than race that automation.
   */
  async advance(orderId: string, adminId: string, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { _count: { select: { productionTasks: true } } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot mark an order fulfilled from ${order.status}`,
      );
    }
    if (order._count.productionTasks > 0) {
      throw new BadRequestException(
        'This order has production tasks and completes automatically once they are done',
      );
    }
    assertTransition(order.status, OrderStatus.COMPLETED);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.COMPLETED,
          changedBy: adminId,
          note,
        },
      });
      const copy = orderStatusNotification(
        OrderStatus.COMPLETED,
        order.orderNumber,
      );
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
      return updated;
    });
  }

  async deliver(orderId: string, adminId: string, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot mark an order delivered from ${order.status}`,
      );
    }
    assertTransition(order.status, OrderStatus.DELIVERED);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          changedBy: adminId,
          note,
        },
      });
      const copy = orderStatusNotification(
        OrderStatus.DELIVERED,
        order.orderNumber,
      );
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
      return updated;
    });
  }

  /**
   * Confirm an order (PENDING -> CONFIRMED) and deduct its reserved stock as a
   * SALE. Idempotent and concurrency-safe: the order row is locked FOR UPDATE
   * and a non-PENDING order is a no-op, so a duplicate confirmation (e.g. a mock
   * confirm racing a webhook) can never double-deduct. Called by payments + admin.
   *
   * `note` rides along on the CONFIRMED history row this method writes — but
   * only on that write. The idempotent no-op path (order already confirmed)
   * writes nothing at all, which is exactly why markPaymentPaid's "mark
   * collected" edge ALSO writes an unconditional AuditLog row: a note passed
   * here on a no-op would otherwise simply vanish.
   */
  async confirmOrder(
    orderId: string,
    changedBy?: string,
    note?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ status: OrderStatus; order_number: string; user_id: string }>
      >`
        SELECT status, order_number, user_id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;

      if (locked.length === 0) {
        throw new NotFoundException('Order not found');
      }
      if (locked[0].status !== OrderStatus.PENDING) {
        return; // already confirmed/cancelled — idempotent no-op
      }

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await this.inventory.sale(tx, item.productId, item.quantity, orderId);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
          changedBy: changedBy ?? null,
          note,
        },
      });

      // ProductionTrigger (decision D8, FR-P1). Fires here rather than in the
      // payment module so that ALL three confirmation paths — PayHere webhook,
      // COD placement and admin bank-slip verification — create tasks through
      // one pipeline. Inside the same transaction as the SALE deduction, so a
      // confirmed order and its production tasks exist together or not at all.
      //
      // The early return above already makes this run once per order; the
      // trigger is independently idempotent as well, because the cost of a
      // duplicate task set (a garment cut twice) is far higher than the cost of
      // the extra COUNT.
      await this.production.createTasksForOrder(tx, orderId);

      const copy = orderStatusNotification(
        OrderStatus.CONFIRMED,
        locked[0].order_number,
      );
      if (copy) {
        await tx.notification.create({
          data: {
            userId: locked[0].user_id,
            type: 'order.status_changed',
            title: copy.title,
            body: copy.body,
          },
        });
      }
    });
  }

  async findAllOrders(query: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    method?: PaymentMethod;
    from?: string;
    to?: string;
    search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.paymentStatus || query.method
        ? {
            payment: {
              ...(query.paymentStatus ? { status: query.paymentStatus } : {}),
              ...(query.method ? { method: query.method } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              {
                user: {
                  firstName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  lastName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { product: true } },
          payment: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * The single source for the admin order-detail buttons (plan 7.1 tasks 2
   * and 5). ALL FIVE are always computed, whether allowed or not — the
   * frontend never infers a reason, it only ever renders the one written
   * here. "confirm" and "mark_collected" are payment actions with an
   * order-status side effect (PaymentsService.markPaymentPaid) — see
   * order.machine.ts's header comment on why they are not re-derived from
   * the pure graph the other three use.
   */
  private computeAdminActions(order: {
    status: OrderStatus;
    hasProductionTasks: boolean;
    payment: { method: PaymentMethod; status: PaymentStatus } | null;
  }) {
    const allowed = new Set(
      allowedOrderActions({
        status: order.status,
        hasProductionTasks: order.hasProductionTasks,
      }),
    );

    const confirmAllowed = order.status === OrderStatus.PENDING;
    const markCollectedAllowed =
      order.payment?.method === PaymentMethod.COD &&
      order.payment?.status !== PaymentStatus.COMPLETED;

    const reasonFor = (action: OrderAction): string | null => {
      if (allowed.has(action)) return null;
      if (action === 'advance' && order.hasProductionTasks) {
        return 'This order has production tasks and completes automatically';
      }
      return `Not available while the order is ${order.status.toLowerCase().replace('_', ' ')}`;
    };

    return [
      {
        action: 'confirm' as const,
        label: 'Confirm order',
        allowed: confirmAllowed,
        reason: confirmAllowed ? null : 'Only a pending order can be confirmed',
      },
      {
        action: 'cancel' as const,
        label: 'Cancel order',
        allowed: allowed.has('cancel'),
        reason: reasonFor('cancel'),
        destructive: true,
        requiresAcknowledgeRefund:
          order.payment?.status === PaymentStatus.COMPLETED,
      },
      {
        action: 'advance' as const,
        label: 'Mark fulfilled',
        allowed: allowed.has('advance'),
        reason: reasonFor('advance'),
      },
      {
        action: 'deliver' as const,
        label: 'Mark delivered',
        allowed: allowed.has('deliver'),
        reason: reasonFor('deliver'),
      },
      {
        action: 'mark_collected' as const,
        label: 'Mark cash collected',
        allowed: markCollectedAllowed,
        reason: markCollectedAllowed
          ? null
          : order.payment?.method !== PaymentMethod.COD
            ? 'This order was not placed as cash on delivery'
            : 'This payment has already been collected',
      },
    ];
  }

  /** Admin-only: resolves each history row's actor to a display name.
   *  `null` (nothing clicked a button — the order's own creation, or a
   *  production-floor-driven move) resolves to "System", never left blank. */
  private async resolveChangedByNames<T extends { changedBy: string | null }>(
    history: T[],
  ): Promise<Array<T & { changedByName: string }>> {
    const ids = [
      ...new Set(
        history
          .map((h) => h.changedBy)
          .filter((id): id is string => id !== null),
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );

    return history.map((h) => ({
      ...h,
      changedByName: h.changedBy
        ? (nameById.get(h.changedBy) ?? 'Unknown')
        : 'System',
    }));
  }
}
