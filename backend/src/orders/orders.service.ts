import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionService } from '../production/production.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { AuthService, loginRequired } from '../auth/auth.service';
import { ContactVerificationService } from '../verification/contact-verification.service';
import { normalizeLkPhone } from '../common/phone.util';
import {
  maxOpenGuestOrdersPerIp,
  maxOpenPendingPerUser,
  reservationTtlMinutes,
} from '../common/config/limits';
import { CreateOrderDto } from './dto/create-order.dto';
import { GuestCheckoutDto, GuestSendCodeDto } from './dto/guest-checkout.dto';
import { validateMeasurements } from './measurements.config';
import {
  OrderStatus,
  Prisma,
  UserRole,
  PaymentStatus,
  PaymentMethod,
  PaymentPlan,
  VerificationChannel,
} from '@prisma/client';
import {
  OrderAction,
  allowedOrderActions,
  assertTransition,
  canTransition,
  orderStatusNotification,
} from './order.machine';

type Tx = Prisma.TransactionClient;

/** Who/what is placing a guest order — resolved by the controller. */
export interface GuestCheckoutContext {
  userAgent?: string;
  ip?: string;
  /** Set when the request carried a valid access token (a stale-tab "guest"). */
  authenticatedUserId?: string;
}

/** The order a key in selectedAttributes may describe. Anything else is refused (QA P2-3). */
const ALLOWED_ATTRIBUTE_KEYS = new Set(['size']);
const MAX_SIZE_LABEL_LENGTH = 50;

/** A tailored ("Custom") line is cut to measurements, never taken from per-size stock. */
const CUSTOM_SIZE = 'Custom';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private production: ProductionService,
    private dispatch: NotificationDispatchService,
    @Optional() private authService?: AuthService,
    @Optional() private contactVerification?: ContactVerificationService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXL-${timestamp}-${random}`;
  }

  // ─── Guest checkout (QA P0-1, P0-2, P1-8) ─────────────────────────────────

  /**
   * Send a one-time code to a guest's email or phone so they can pay Cash on
   * Delivery. Public and rate-limited (controller throttle + per-contact
   * cooldown/hourly cap). A contact that already has an account is told to
   * sign in instead — checkout would refuse it anyway.
   */
  async sendGuestCode(dto: GuestSendCodeDto) {
    if (!this.contactVerification) {
      throw new BadRequestException('Verification is unavailable');
    }
    const email = dto.email.trim().toLowerCase();
    const phone = normalizeLkPhone(dto.phone)!; // DTO @IsLkPhone validated it
    await this.assertContactIsNew(email, phone);

    const channel = dto.channel ?? VerificationChannel.EMAIL;
    return this.contactVerification.sendCode(
      channel === VerificationChannel.EMAIL ? email : phone,
      channel,
    );
  }

  /**
   * QA P0-1: this endpoint used to FIND any existing account by email/phone and
   * hand back a logged-in session for it — no password, no code. A guest order
   * with admin@textileshop.com returned a working ADMIN token.
   *
   * The rules now:
   *  - a request carrying a valid access token orders as THAT user (stale tab);
   *    no new session is issued;
   *  - a contact that belongs to an account is refused with LOGIN_REQUIRED;
   *  - Cash on Delivery needs a code sent to the contact (sendGuestCode), and the
   *    account is created only after that code checks out (QA P1-8);
   *  - only a brand-new account ever receives a session.
   */
  async guestCheckout(dto: GuestCheckoutDto, ctx: GuestCheckoutContext = {}) {
    if (!this.authService) {
      throw new BadRequestException('Auth service unavailable for guest checkout');
    }
    const orderInput: CreateOrderDto = {
      items: dto.items,
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      notes: dto.notes,
    };

    // A signed-in customer whose tab still showed the guest form. The order is
    // theirs; the email/phone typed into the form grant nothing.
    if (ctx.authenticatedUserId) {
      const order = await this.create(ctx.authenticatedUserId, orderInput);
      if (dto.paymentMethod === PaymentMethod.COD) {
        await this.placeCodPayment(order.id);
      }
      return { order: await this.reloadOrder(order.id), session: null };
    }

    const email = dto.email.trim().toLowerCase();
    const phone = normalizeLkPhone(dto.phone)!; // DTO @IsLkPhone validated it
    await this.assertContactIsNew(email, phone);

    let emailVerified = false;
    let phoneVerified = false;
    if (dto.paymentMethod === PaymentMethod.COD) {
      // COD dispatches a courier on trust, so the contact must be proven first.
      if (!dto.verificationCode) {
        throw new BadRequestException({
          code: 'VERIFICATION_REQUIRED',
          message:
            'Cash on Delivery needs a one-time code. Request one, then enter it to place the order.',
        });
      }
      if (!this.contactVerification) {
        throw new BadRequestException('Verification is unavailable');
      }
      const channel = dto.verificationChannel ?? VerificationChannel.EMAIL;
      await this.contactVerification.verifyCode(
        channel === VerificationChannel.EMAIL ? email : phone,
        channel,
        dto.verificationCode,
      );
      emailVerified = channel === VerificationChannel.EMAIL;
      phoneVerified = channel === VerificationChannel.SMS;
    }

    // QA P0-2: one address may hold only a few unpaid guest reservations.
    await this.assertGuestIpCapacity(ctx.ip);

    const user = await this.authService.createGuestUser({
      email,
      phone,
      fullName: dto.fullName,
      password: dto.password,
      emailVerified,
      phoneVerified,
    });

    let order: Awaited<ReturnType<OrdersService['createOrderInternal']>>;
    try {
      order = await this.createOrderInternal(user.id, orderInput, {
        clientIp: ctx.ip,
      });
    } catch (err) {
      // No order means no reason for the account to exist: leave nothing
      // behind that would squat on this email/phone.
      await this.prisma.user
        .delete({ where: { id: user.id } })
        .catch((e) =>
          this.logger.warn(`Could not remove guest account ${user.id}: ${String(e)}`),
        );
      throw err;
    }

    if (dto.paymentMethod === PaymentMethod.COD) {
      // QA P1-8: the guest COD branch never created a payment or confirmed the
      // order, so it sat PENDING forever. Do it here, server-side.
      await this.placeCodPayment(order.id);
    }

    const session = await this.authService.issueGuestSession(user, ctx.userAgent);
    return { order: await this.reloadOrder(order.id), session };
  }

  /** LOGIN_REQUIRED when the email or phone already belongs to an account. */
  private async assertContactIsNew(email: string, phone: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { id: true },
    });
    if (existing) throw loginRequired();
  }

  private async assertGuestIpCapacity(ip?: string) {
    if (!ip) return;
    const open = await this.prisma.order.count({
      where: {
        clientIp: ip,
        status: OrderStatus.PENDING,
        createdAt: { gt: this.reservationCutoff() },
      },
    });
    if (open >= maxOpenGuestOrdersPerIp()) {
      throw new HttpException(
        {
          code: 'TOO_MANY_PENDING_ORDERS',
          message:
            'There are already several unpaid orders from your connection. Complete or cancel one, or wait a few minutes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Orders created before this instant have outlived their reservation. */
  private reservationCutoff(now = Date.now()): Date {
    return new Date(now - reservationTtlMinutes() * 60_000);
  }

  private reloadOrder(orderId: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true },
    });
  }

  /**
   * Record a Cash-on-Delivery payment and confirm the order (SALE). Used by the
   * guest COD path; the signed-in path goes through PaymentsService.createCodPayment.
   */
  private async placeCodPayment(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { total: true },
    });
    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: 'LKR',
        status: PaymentStatus.PENDING, // collected by the courier
        method: PaymentMethod.COD,
        paymentPlan: PaymentPlan.FULL,
      },
      update: {
        status: PaymentStatus.PENDING,
        method: PaymentMethod.COD,
        currency: 'LKR',
      },
    });
    await this.confirmOrder(orderId);
  }

  async create(userId: string, dto: CreateOrderDto) {
    const contact = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, phoneVerified: true },
    });
    if (!contact || (!contact.emailVerified && !contact.phoneVerified)) {
      throw new BadRequestException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Verify your email or phone number before placing an order.',
      });
    }

    return this.createOrderInternal(userId, dto);
  }

  private async createOrderInternal(
    userId: string,
    dto: CreateOrderDto,
    opts: { clientIp?: string } = {},
  ) {
    // QA P0-2: one account may hold only a few unpaid reservations at a time.
    const openForUser = await this.prisma.order.count({
      where: {
        userId,
        status: OrderStatus.PENDING,
        createdAt: { gt: this.reservationCutoff() },
      },
    });
    if (openForUser >= maxOpenPendingPerUser()) {
      throw new HttpException(
        {
          code: 'TOO_MANY_PENDING_ORDERS',
          message:
            'You already have several unpaid orders. Pay for or cancel one before placing another.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // QA P2-3: selectedAttributes is snapshotted onto the order line and shown
    // to staff, so accept only the keys the shop understands, as short strings.
    for (const item of dto.items) {
      const attrs = item.selectedAttributes;
      if (!attrs) continue;
      for (const [key, value] of Object.entries(attrs)) {
        if (!ALLOWED_ATTRIBUTE_KEYS.has(key)) {
          throw new BadRequestException(`Unknown order attribute "${key}"`);
        }
        if (
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > MAX_SIZE_LABEL_LENGTH
        ) {
          throw new BadRequestException(`Invalid value for "${key}"`);
        }
      }
    }

    // Validate all products exist and have sufficient stock. QA P2-2: compare
    // against the UNIQUE ids — the same product twice (sizes S and M) is two
    // lines but one row, and used to fail as "not found or inactive".
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products not found or inactive',
      );
    }

    // Check stock availability (a fast, friendly pre-check — the guarded
    // UPDATEs inside the transaction are what actually prevent overselling).
    const requestedPerProduct = new Map<string, number>();
    for (const item of dto.items) {
      requestedPerProduct.set(
        item.productId,
        (requestedPerProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      const requested = requestedPerProduct.get(product.id) ?? item.quantity;
      if (product.stockQuantity < requested) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`,
        );
      }

      // QA P1-6: a product that tracks per-size stock must be ordered in one
      // of ITS sizes (or tailored to measurements). An unknown size used to
      // slip past the size check entirely.
      const sizeStock = this.sizeStockOf(product.attributes);
      const selectedSize = this.selectedSizeOf(item);
      if (sizeStock && selectedSize !== CUSTOM_SIZE) {
        if (!selectedSize) {
          throw new BadRequestException(`Choose a size for "${product.name}"`);
        }
        if (typeof sizeStock[selectedSize] !== 'number') {
          throw new BadRequestException(
            `Size "${selectedSize}" is not available for "${product.name}"`,
          );
        }
        if (sizeStock[selectedSize] < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for size "${selectedSize}" of "${product.name}". Available: ${sizeStock[selectedSize]}`,
          );
        }
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
      const selectedSize = (item.selectedAttributes as any)?.size;
      return validateMeasurements(
        product.name,
        product.productType,
        product.requiresMeasurement,
        item.measurements ?? null,
        selectedSize,
        product.subCategory,
        product.attributes,
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
        selectedAttributes: (item.selectedAttributes ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
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
          clientIp: opts.clientIp ?? null,
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

        // QA P1-6: per-size stock is taken by ONE guarded UPDATE inside this
        // transaction. It used to be a read (outside the transaction) followed
        // by a full write-back, so parallel orders all saw the same count and
        // ten orders went through for two size-M shirts.
        const selectedSize = this.selectedSizeOf(item);
        if (
          selectedSize &&
          selectedSize !== CUSTOM_SIZE &&
          this.sizeStockOf(product?.attributes)
        ) {
          await this.inventory.reserveSize(
            tx,
            item.productId,
            selectedSize,
            item.quantity,
            product?.name,
          );
        }
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
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

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
        take: safeLimit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
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
        payment: {
          include: {
            installments: {
              orderBy: { installmentNo: 'asc' },
            },
          },
        },
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
      include: {
        payment: {
          include: { installments: true },
        },
      },
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

    const hasPaidInstallments =
      order.payment?.installments?.some(
        (inst) => inst.status === PaymentStatus.COMPLETED,
      ) ?? false;
    const isPaidOrPartiallyPaid =
      order.payment?.status === PaymentStatus.COMPLETED || hasPaidInstallments;

    if (isPaidOrPartiallyPaid && !options.acknowledgeRefund) {
      throw new BadRequestException(
        'This order has collected payments. Cancelling requires acknowledging that a refund must be issued manually — cancelling does not refund the customer automatically.',
      );
    }

    const refundDetail = isPaidOrPartiallyPaid
      ? 'A refund will be processed manually.'
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      // QA P1-9 / P1-2: lock the order row and re-check it. The checks above
      // read it without a lock, so a worker starting a task (which moves the
      // order to IN_PRODUCTION) or a payment confirming it could slip in
      // between. production.act() and confirmOrder() take the same lock, so
      // these now run one after another instead of interleaving.
      const current = await this.lockOrderStatus(tx, orderId);
      if (current !== order.status) {
        throw new ConflictException(
          `This order changed to ${current.toLowerCase().replace('_', ' ')} while you were cancelling it. Reload and try again.`,
        );
      }

      return this.applyCancellation(tx, {
        order,
        changedBy: actor.id,
        note: options.note,
        refundDetail,
        hasPaidInstallments,
      });
    });
  }

  /**
   * QA P0-2: release the stock held by an unpaid order once its reservation
   * has expired. Nothing used to do this — every abandoned PayHere/installment
   * checkout (and every abusive one) held its stock forever.
   *
   * Runs one order per transaction behind the same row lock as cancel() and
   * confirmOrder(), and re-checks under that lock, so a payment confirming the
   * order at the same moment wins cleanly or loses cleanly, never half-and-half.
   * Returns false when the order no longer qualifies (paid, COD, not PENDING).
   */
  async expireUnpaidOrder(orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const status = await this.lockOrderStatus(tx, orderId).catch(() => null);
      if (status !== OrderStatus.PENDING) return false;

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payment: { include: { installments: true } } },
      });
      if (order.createdAt > this.reservationCutoff()) return false;
      // COD is confirmed at placement; a completed payment means the money is
      // in and confirmation is on its way. Neither is an abandoned checkout.
      if (order.payment?.method === PaymentMethod.COD) return false;
      if (order.payment?.status === PaymentStatus.COMPLETED) return false;
      const hasPaidInstallments =
        order.payment?.installments.some(
          (i) => i.status === PaymentStatus.COMPLETED,
        ) ?? false;
      if (hasPaidInstallments) return false;

      await this.applyCancellation(tx, {
        order,
        changedBy: null,
        note: `Automatically cancelled — payment was not received within ${reservationTtlMinutes()} minutes.`,
        hasPaidInstallments: false,
      });
      return true;
    });
  }

  /** Unpaid PENDING orders whose reservation window has passed (oldest first). */
  async findExpiredUnpaidOrderIds(limit = 100): Promise<string[]> {
    const rows = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: this.reservationCutoff() },
        OR: [
          { payment: null },
          {
            payment: {
              method: { not: PaymentMethod.COD },
              status: { not: PaymentStatus.COMPLETED },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }

  /** SELECT … FOR UPDATE on the order row; the one lock every status writer shares. */
  private async lockOrderStatus(tx: Tx, orderId: string): Promise<OrderStatus> {
    const rows = await tx.$queryRaw<Array<{ status: OrderStatus }>>`
      SELECT status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException('Order not found');
    return rows[0].status;
  }

  /**
   * The body of a cancellation, shared by the customer/admin cancel and the
   * reservation-expiry sweep. Caller must hold the order row lock.
   */
  private async applyCancellation(
    tx: Tx,
    input: {
      order: {
        id: string;
        status: OrderStatus;
        orderNumber: string;
        userId: string;
        payment: {
          id: string;
          status: PaymentStatus;
          paymentPlan: PaymentPlan;
        } | null;
      };
      changedBy: string | null;
      note?: string;
      refundDetail?: string;
      hasPaidInstallments: boolean;
    },
  ) {
    const { order } = input;
    const orderId = order.id;

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (order.status === OrderStatus.PENDING) {
        // Not yet sold — free the reservation.
        await this.inventory.release(tx, item.productId, item.quantity, orderId);
      } else {
        // Already sold (CONFIRMED) — return units to available.
        await this.inventory.restock(tx, item.productId, item.quantity, orderId);
      }

      // Return per-size stock with one guarded UPDATE (QA P1-6) — the old
      // read-modify-write here lost updates to concurrent checkouts.
      const size = this.selectedSizeOf(item);
      if (size && size !== CUSTOM_SIZE) {
        await this.inventory.restoreSize(tx, item.productId, size, item.quantity);
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
        changedBy: input.changedBy,
        note: input.note,
      },
    });

    if (order.payment) {
      if (order.payment.paymentPlan === PaymentPlan.INSTALLMENT) {
        // Void any uncollected installments so no phantom debts remain on cancelled order
        await tx.installment.updateMany({
          where: {
            paymentId: order.payment.id,
            status: PaymentStatus.PENDING,
          },
          data: { status: PaymentStatus.FAILED },
        });

        await tx.payment.update({
          where: { orderId },
          data: {
            status: input.hasPaidInstallments
              ? PaymentStatus.REFUNDED
              : PaymentStatus.FAILED,
          },
        });
      } else if (order.payment.status === PaymentStatus.COMPLETED) {
        await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.REFUNDED },
        });
      } else if (order.payment.status === PaymentStatus.PENDING) {
        // Nothing was ever collected — there is nothing to refund, only a
        // promise that will now never be honoured.
        await tx.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.FAILED },
        });
      }
    }

    // QA P1-9: a cancelled order's production tasks are dead work. The order
    // can only be cancelled before any task has started (IN_PRODUCTION is not
    // cancellable), so the tasks are unstarted; they stay as history, but the
    // board, the worker queue and production.act() all exclude cancelled
    // orders, so nobody cuts cloth for an order that no longer exists.

    const copy = orderStatusNotification(
      OrderStatus.CANCELLED,
      order.orderNumber,
      input.refundDetail,
    );
    if (copy) {
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order.status_changed',
          targetId: orderId,
          title: copy.title,
          body: copy.body,
        },
      });
    }

    return result;
  }

  /** products.attributes.sizeStock, when the product tracks stock per size. */
  private sizeStockOf(attributes: unknown): Record<string, number> | null {
    const sizeStock = (attributes as Record<string, unknown> | null)?.sizeStock;
    return sizeStock && typeof sizeStock === 'object' && !Array.isArray(sizeStock)
      ? (sizeStock as Record<string, number>)
      : null;
  }

  private selectedSizeOf(item: { selectedAttributes?: unknown }): string | null {
    const size = (item.selectedAttributes as Record<string, unknown> | null)?.size;
    return typeof size === 'string' && size.trim() ? size.trim() : null;
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
            targetId: orderId,
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
            targetId: orderId,
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
    // The transaction reports whether a REAL transition happened, so the
    // post-commit email below fires exactly once per order — never on the
    // idempotent no-op path (e.g. a duplicate webhook delivery).
    const didConfirm = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ status: OrderStatus; order_number: string; user_id: string }>
      >`
        SELECT status, order_number, user_id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;

      if (locked.length === 0) {
        throw new NotFoundException('Order not found');
      }
      if (locked[0].status !== OrderStatus.PENDING) {
        return false; // already confirmed/cancelled — idempotent no-op
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
            targetId: orderId,
            title: copy.title,
            body: copy.body,
          },
        });
      }

      return true;
    });

    // AFTER the commit: an email cannot be rolled back, so it must never be
    // sent from inside the transaction. The dispatcher itself never throws.
    if (didConfirm) {
      await this.dispatch.sendOrderConfirmation(orderId);
    }
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
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
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
    payment: {
      method: PaymentMethod;
      status: PaymentStatus;
      paymentPlan: PaymentPlan;
    } | null;
  }) {
    const allowed = new Set(
      allowedOrderActions({
        status: order.status,
        hasProductionTasks: order.hasProductionTasks,
      }),
    );

    // QA P1-7: "Confirm" marks the WHOLE payment received. On an installment
    // plan that used to flip the payment to COMPLETED while every installment
    // stayed unpaid — and reported the full amount as revenue on day one. An
    // installment order is confirmed by recording its first installment.
    const isInstallmentPlan =
      order.payment?.paymentPlan === PaymentPlan.INSTALLMENT;
    const confirmAllowed =
      order.status === OrderStatus.PENDING && !isInstallmentPlan;
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
        reason: confirmAllowed
          ? null
          : isInstallmentPlan && order.status === OrderStatus.PENDING
            ? 'Installment order: record the first installment to confirm it'
            : 'Only a pending order can be confirmed',
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
