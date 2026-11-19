import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentPlan,
  Prisma,
  UserRole,
} from '@prisma/client';
import Stripe from 'stripe';
import {
  payhereCheckoutHash,
  payhereNotifySig,
  formatPayhereAmount,
  timingSafeCompare,
} from './payhere.util';

/** QA P1-7: plans run from 2 to 6 monthly payments. */
export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 6;

/** PayHere order reference for one installment: `<orderNumber>-I<n>`. */
const INSTALLMENT_REF = /^(.+)-I(\d{1,2})$/;

const SHOP_CURRENCY = 'LKR';

type PayhereNotifyBody = Record<string, unknown>;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private ordersService: OrdersService,
    private dispatch: NotificationDispatchService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && stripeKey !== 'sk_test_mock') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
      this.logger.log('Stripe SDK initialized');
    } else {
      this.logger.warn('Stripe SDK not initialized — using mock payments');
    }
  }

  // ─── Full Payment (legacy Stripe path, D12) ──────────────

  async createFullPayment(orderId: string, userId: string) {
    const order = await this.findOrderForPayment(orderId, userId);

    // Create a Stripe PaymentIntent or mock one
    let clientSecret: string;
    let stripePaymentIntentId: string | null = null;

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100), // cents
        currency: SHOP_CURRENCY.toLowerCase(),
        metadata: { orderId, userId, paymentPlan: 'FULL' },
      });
      clientSecret = paymentIntent.client_secret!;
      stripePaymentIntentId = paymentIntent.id;
    } else {
      clientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`;
      stripePaymentIntentId = `pi_mock_${Date.now()}`;
    }

    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: SHOP_CURRENCY,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.STRIPE,
        paymentPlan: PaymentPlan.FULL,
        transactionId: stripePaymentIntentId,
      },
      update: {
        status: PaymentStatus.PENDING,
        transactionId: stripePaymentIntentId,
        paymentPlan: PaymentPlan.FULL,
        currency: SHOP_CURRENCY,
      },
    });

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentPlan: 'FULL',
      clientSecret,
    };
  }

  // ─── Installment plan (QA P1-7) ──────────────────────────

  /**
   * Split a PENDING order into 2–6 monthly installments.
   *
   * The old version accepted anything: 0 and "abc" became 3, -2 created a
   * payment with NO installment rows, 2.5 created two rows summing Rs 7,120 of
   * Rs 8,900, and 500 scheduled payments until 2068 — all stored as USD. Now:
   * the count is a whole number in range (DTO and here), the amounts are split
   * in integer cents so they always sum to the order total exactly, the
   * currency is LKR, and a plan cannot be rewritten once money has been paid.
   *
   * The first installment is then paid online through PayHere
   * (createInstallmentPayherePayment); the order is confirmed when it lands.
   */
  async createInstallmentPayment(
    orderId: string,
    userId: string,
    installmentCount: number,
  ) {
    if (
      !Number.isInteger(installmentCount) ||
      installmentCount < MIN_INSTALLMENTS ||
      installmentCount > MAX_INSTALLMENTS
    ) {
      throw new BadRequestException(
        `An installment plan must have between ${MIN_INSTALLMENTS} and ${MAX_INSTALLMENTS} payments`,
      );
    }

    const order = await this.findOrderForPayment(orderId, userId);
    if (order.payment?.method === PaymentMethod.COD) {
      throw new BadRequestException(
        'This order is being paid by Cash on Delivery',
      );
    }

    const totalCents = Math.round(Number(order.total.toFixed(2)) * 100);
    if (totalCents < installmentCount) {
      throw new BadRequestException('This order is too small to split');
    }
    const baseCents = Math.floor(totalCents / installmentCount);
    // The last installment absorbs the rounding remainder (in whole cents).
    const lastCents = totalCents - baseCents * (installmentCount - 1);
    const toAmount = (cents: number) => new Prisma.Decimal(cents).div(100);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { orderId },
        include: { installments: true },
      });
      if (
        existing?.installments.some((i) => i.status === PaymentStatus.COMPLETED)
      ) {
        throw new BadRequestException(
          'An installment has already been paid; the plan can no longer change',
        );
      }

      const payment = await tx.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          amount: order.total,
          currency: SHOP_CURRENCY,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.INSTALLMENT,
          paymentPlan: PaymentPlan.INSTALLMENT,
          installmentCount,
        },
        update: {
          amount: order.total,
          currency: SHOP_CURRENCY,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.INSTALLMENT,
          paymentPlan: PaymentPlan.INSTALLMENT,
          installmentCount,
          transactionId: null,
        },
      });

      await tx.installment.deleteMany({ where: { paymentId: payment.id } });

      const now = new Date();
      await tx.installment.createMany({
        data: Array.from({ length: installmentCount }, (_, idx) => {
          const dueDate = new Date(now);
          dueDate.setMonth(dueDate.getMonth() + idx); // monthly
          return {
            paymentId: payment.id,
            installmentNo: idx + 1,
            amount: toAmount(idx === installmentCount - 1 ? lastCents : baseCents),
            dueDate,
            status: PaymentStatus.PENDING,
          };
        }),
      });
      const installments = await tx.installment.findMany({
        where: { paymentId: payment.id },
        orderBy: { installmentNo: 'asc' },
      });
      return { payment, installments };
    });

    return {
      paymentId: result.payment.id,
      orderId: result.payment.orderId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      status: result.payment.status,
      paymentPlan: 'INSTALLMENT',
      installmentCount,
      firstInstallmentAmount: result.installments[0].amount,
      installments: result.installments.map((inst) => ({
        id: inst.id,
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        dueDate: inst.dueDate,
        status: inst.status,
      })),
    };
  }

  /**
   * QA P1-7: the customer path to actually PAY an installment — a PayHere
   * checkout for exactly that installment's amount. Before this there was no
   * way to pay one at all ("Contact us").
   *
   * Installments are paid in order: only the earliest unpaid one can be paid.
   * The first one can only be paid while the order is still PENDING (paying it
   * is what confirms the order); later ones while the order is live.
   */
  async createInstallmentPayherePayment(installmentId: string, userId: string) {
    const merchant = this.payhereMerchant();

    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: {
            installments: { orderBy: { installmentNo: 'asc' } },
            order: { include: { user: true } },
          },
        },
      },
    });
    // Ownership: another customer's installment is "not found", never "forbidden".
    if (!installment || installment.payment.order.userId !== userId) {
      throw new NotFoundException('Installment not found');
    }
    const { payment } = installment;
    const order = payment.order;

    if (payment.paymentPlan !== PaymentPlan.INSTALLMENT) {
      throw new BadRequestException('This order is not on an installment plan');
    }
    if (installment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('This installment is already paid');
    }
    if (
      order.status === OrderStatus.CANCELLED ||
      installment.status === PaymentStatus.FAILED
    ) {
      throw new BadRequestException(
        'This order was cancelled; its installments can no longer be paid',
      );
    }
    const nextDue = payment.installments.find(
      (i) => i.status !== PaymentStatus.COMPLETED,
    );
    if (nextDue?.id !== installment.id) {
      throw new BadRequestException(
        `Pay installment ${nextDue?.installmentNo ?? 1} first — installments are paid in order`,
      );
    }
    if (installment.installmentNo === 1 && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('This order can no longer take payments');
    }

    const checkout = this.buildPayhereCheckout({
      merchant,
      orderRef: `${order.orderNumber}-I${installment.installmentNo}`,
      amount: installment.amount.toFixed(2),
      itemsLabel: `Order ${order.orderNumber} — installment ${installment.installmentNo} of ${payment.installments.length}`,
      user: order.user,
      shippingAddress: order.shippingAddress,
      returnPath: `/account/orders/${order.id}/installments?paid=${installment.installmentNo}`,
      cancelPath: `/account/orders/${order.id}/installments`,
    });

    return {
      installmentId: installment.id,
      installmentNo: installment.installmentNo,
      amount: installment.amount,
      ...checkout,
    };
  }

  /**
   * The one place an installment becomes paid — PayHere notify, an admin
   * recording cash/bank, or the legacy Stripe webhook all come through here.
   *
   * Idempotent and race-safe: the order row is locked, and the installment is
   * flipped with a guarded update (status <> COMPLETED), so a redelivered
   * webhook or a double click can never double-credit. The overall payment
   * becomes COMPLETED only when EVERY installment is paid (QA P1-7: an admin
   * "mark paid" used to complete the whole payment while all three
   * installments still showed unpaid). Paying installment 1 confirms the order.
   */
  async recordInstallmentPaid(
    installmentId: string,
    opts: { transactionId?: string | null } = {},
  ): Promise<{
    success: true;
    alreadyPaid: boolean;
    allPaid: boolean;
    orderId: string;
    orderStatus: OrderStatus;
  }> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.installment.findUnique({
        where: { id: installmentId },
        select: { paymentId: true, payment: { select: { orderId: true } } },
      });
      if (!inst) throw new NotFoundException('Installment not found');
      const orderId = inst.payment.orderId;

      const locked = await tx.$queryRaw<Array<{ status: OrderStatus }>>`
        SELECT status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const orderStatus = locked[0]?.status;

      const flipped = await tx.installment.updateMany({
        where: { id: installmentId, status: { not: PaymentStatus.COMPLETED } },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
          ...(opts.transactionId ? { transactionId: opts.transactionId } : {}),
        },
      });

      const unpaid = await tx.installment.count({
        where: {
          paymentId: inst.paymentId,
          status: { not: PaymentStatus.COMPLETED },
        },
      });
      if (unpaid === 0) {
        await tx.payment.updateMany({
          where: { id: inst.paymentId, status: { not: PaymentStatus.COMPLETED } },
          data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
        });
      }
      return {
        orderId,
        orderStatus,
        alreadyPaid: flipped.count === 0,
        allPaid: unpaid === 0,
      };
    });

    // Confirmation (SALE + production tasks) runs in its own transaction, after
    // this one committed; confirmOrder is itself locked and idempotent.
    if (outcome.orderStatus === OrderStatus.PENDING) {
      await this.ordersService.confirmOrder(outcome.orderId);
    }
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: outcome.orderId },
      select: { status: true },
    });
    return {
      success: true,
      alreadyPaid: outcome.alreadyPaid,
      allPaid: outcome.allPaid,
      orderId: outcome.orderId,
      orderStatus: order.status,
    };
  }

  // ─── Pay Individual Installment (legacy Stripe path) ─────

  async payInstallment(installmentId: string, userId: string) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: {
            order: { select: { id: true, userId: true } },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    if (installment.payment.order.userId !== userId) {
      throw new NotFoundException('Installment not found');
    }

    if (installment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Installment is already paid');
    }

    let clientSecret: string;
    let stripePaymentIntentId: string | null = null;

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(installment.amount) * 100),
        currency: SHOP_CURRENCY.toLowerCase(),
        metadata: {
          orderId: installment.payment.orderId,
          installmentId: installment.id,
          installmentNo: String(installment.installmentNo),
          paymentPlan: 'INSTALLMENT',
        },
      });
      clientSecret = paymentIntent.client_secret!;
      stripePaymentIntentId = paymentIntent.id;
    } else {
      clientSecret = `pi_mock_inst_pay_${Date.now()}_secret`;
      stripePaymentIntentId = `pi_mock_inst_pay_${Date.now()}`;
    }

    await this.prisma.installment.update({
      where: { id: installmentId },
      data: { stripePaymentId: stripePaymentIntentId },
    });

    return {
      installmentId: installment.id,
      installmentNo: installment.installmentNo,
      amount: installment.amount,
      clientSecret,
    };
  }

  // ─── Confirm Payment (legacy Stripe webhook) ─────────────

  async confirmPayment(orderId: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        installments: true,
        order: { select: { userId: true, status: true, orderNumber: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Ownership guard for client-initiated confirmation. The webhook path is
    // server-trusted (Stripe signature verified) and calls this without a
    // userId, so it is allowed to confirm on the customer's behalf.
    if (userId && payment.order.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentPlan === PaymentPlan.FULL) {
      const updatedPayment = await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });
      if (payment.order.status === OrderStatus.CANCELLED) {
        await this.flagPaidAfterCancel({
          orderId,
          orderNumber: payment.order.orderNumber,
          amount: payment.amount.toFixed(2),
          currency: payment.currency,
          transactionId: payment.transactionId ?? 'stripe',
        });
      } else {
        await this.ordersService.confirmOrder(orderId);
      }
      return updatedPayment;
    }

    // Installment plan: the first installment is paid; that confirms the order.
    const first = payment.installments.find((inst) => inst.installmentNo === 1);
    if (first) {
      await this.recordInstallmentPaid(first.id);
    }
    return this.prisma.payment.findUniqueOrThrow({
      where: { orderId },
      include: { installments: true },
    });
  }

  // ─── Confirm Individual Installment (legacy Stripe webhook) ──

  async confirmInstallment(installmentId: string, userId?: string) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: {
            order: { select: { userId: true } },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    // Ownership guard; webhook path passes no userId (server-trusted).
    if (userId && installment.payment.order.userId !== userId) {
      throw new NotFoundException('Installment not found');
    }

    const result = await this.recordInstallmentPaid(installmentId);
    return { success: true, allPaid: result.allPaid };
  }

  // ─── Get Payment Details ────────────────────────────────

  async getPaymentByOrderId(orderId: string, userId?: string, isAdmin = false) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    // Object-level authorization: a customer may only read their own payment.
    if (!isAdmin && payment.order.userId !== userId) {
      throw new NotFoundException('Payment not found for this order');
    }

    return payment;
  }

  // ─── Get Installment Schedule ───────────────────────────

  async getInstallmentSchedule(
    orderId: string,
    userId?: string,
    isAdmin = false,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
        order: {
          select: {
            id: true,
            userId: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Object-level authorization: a customer may only read their own schedule.
    if (!isAdmin && payment.order.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      orderStatus: payment.order.status,
      totalAmount: payment.amount,
      currency: payment.currency,
      paymentPlan: payment.paymentPlan,
      installmentCount: payment.installmentCount,
      overallStatus: payment.status,
      installments: payment.installments.map((inst) => ({
        id: inst.id,
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        dueDate: inst.dueDate,
        status: inst.status,
        paidAt: inst.paidAt,
      })),
    };
  }

  // ─── Stripe Config ──────────────────────────────────────

  getStripeConfig() {
    const publishableKey = this.configService.get<string>(
      'STRIPE_PUBLISHABLE_KEY',
    );
    return {
      publishableKey: publishableKey || null,
      isConfigured: !!this.stripe,
    };
  }

  // ─── Webhook ────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string) {
    if (!this.stripe) {
      this.logger.warn('Stripe not configured — skipping webhook');
      return { received: true };
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret!,
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata;

        if (metadata.installmentId) {
          await this.confirmInstallment(metadata.installmentId);
        } else if (metadata.orderId) {
          await this.confirmPayment(metadata.orderId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        this.logger.warn(`Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  // ─── PayHere ─────────────────────────────────────────────

  async createPayherePayment(orderId: string, userId: string) {
    const merchant = this.payhereMerchant();

    // QA P1-2: findOrderForPayment refuses anything but a PENDING order — a
    // cancelled order used to get a PayHere checkout and then take the money.
    const order = await this.findOrderForPayment(orderId, userId, {
      includeUser: true,
    });
    if (order.payment?.paymentPlan === PaymentPlan.INSTALLMENT) {
      throw new BadRequestException(
        'This order is on an installment plan — pay the next installment instead',
      );
    }
    if (order.payment?.method === PaymentMethod.COD) {
      throw new BadRequestException(
        'This order is being paid by Cash on Delivery',
      );
    }

    const checkout = this.buildPayhereCheckout({
      merchant,
      orderRef: order.orderNumber,
      amount: order.total.toFixed(2),
      itemsLabel: `Order ${order.orderNumber}`,
      user: order.user!,
      shippingAddress: order.shippingAddress,
      returnPath: `/payment/success?orderId=${orderId}`,
      cancelPath: `/payment/cancel?orderId=${orderId}`,
    });

    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: SHOP_CURRENCY,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYHERE,
        paymentPlan: PaymentPlan.FULL,
      },
      update: {
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYHERE,
        currency: SHOP_CURRENCY,
      },
    });

    return checkout;
  }

  /**
   * PayHere server-to-server notify. Assume it arrives more than once and
   * that forgeries arrive too.
   *
   * QA P1-1: the raw event used to be stored BEFORE the signature check, and
   * the unique (gateway, transaction_id, event_status) key was claimed by
   * whatever arrived first. A forged notify for a payment_id therefore made the
   * genuine, correctly signed notify look like a duplicate — the customer was
   * charged and the order stayed PENDING. Now:
   *  - no payment_id: rejected, nothing stored (no unbounded junk rows);
   *  - bad signature: stored for audit with signature_valid = false, which the
   *    PARTIAL unique index ignores — it can never block the real event;
   *  - good signature: deduplicated against other VERIFIED events only.
   */
  async handlePayhereNotify(body: PayhereNotifyBody) {
    const merchantId = this.configService.get<string>('PAYHERE_MERCHANT_ID');
    const merchantSecret =
      this.configService.get<string>('PAYHERE_MERCHANT_SECRET') ?? '';

    const field = (key: string) =>
      body?.[key] === undefined || body?.[key] === null ? '' : String(body[key]);
    const orderRef = field('order_id');
    const paymentId = field('payment_id');
    const statusCode = field('status_code');
    const payhereAmount = field('payhere_amount');
    const payhereCurrency = field('payhere_currency');
    const md5sig = field('md5sig');

    if (!paymentId || paymentId.length > 64 || !statusCode) {
      throw new BadRequestException('Malformed PayHere notification');
    }

    const localSig = merchantSecret
      ? payhereNotifySig({
          merchantId: field('merchant_id'),
          orderId: orderRef,
          payhereAmount,
          payhereCurrency,
          statusCode,
          merchantSecret,
        })
      : '';
    const signatureValid =
      !!merchantSecret &&
      !!md5sig &&
      // F-06: timing-safe comparison prevents timing side-channel on MD5 sig
      timingSafeCompare(localSig, md5sig.toUpperCase()) &&
      field('merchant_id') === merchantId;

    // 1. Forged / unsigned: keep an audit row, change nothing, block nothing.
    if (!signatureValid) {
      this.logger.warn(
        `PayHere notify with invalid signature (order ${orderRef.slice(0, 40)})`,
      );
      await this.prisma.paymentWebhookEvent.create({
        data: {
          gateway: 'payhere',
          transactionId: paymentId,
          eventStatus: statusCode.slice(0, 8),
          payload: body as Prisma.InputJsonValue,
          signature: md5sig ? md5sig.slice(0, 64) : null,
          signatureValid: false,
          processed: true,
          processingError: 'INVALID_SIGNATURE',
        },
      });
      return { received: true };
    }

    // 2. Verified: claim the idempotency key (verified events only).
    let eventId: string;
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          gateway: 'payhere',
          transactionId: paymentId,
          eventStatus: statusCode,
          payload: body as Prisma.InputJsonValue,
          signature: md5sig,
          signatureValid: true,
          processed: false,
        },
      });
      eventId = event.id;
    } catch (e) {
      if (!this.isUniqueViolation(e)) throw e;
      const existing = await this.prisma.paymentWebhookEvent.findFirst({
        where: {
          gateway: 'payhere',
          transactionId: paymentId,
          eventStatus: statusCode,
          signatureValid: true,
        },
      });
      // A genuine redelivery of an event we already processed: acknowledge.
      if (!existing || existing.processed) {
        return { received: true, duplicate: true };
      }
      // We stored it but never finished (crash/timeout): process it again.
      // Every step below is idempotent.
      eventId = existing.id;
    }

    const finish = async (error?: string) => {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventId },
        data: { processed: true, processingError: error ?? null },
      });
      return { received: true };
    };

    // 3. Resolve what was paid: a whole order, or one installment of a plan.
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderRef },
      include: { payment: true },
    });
    if (!order) {
      const match = INSTALLMENT_REF.exec(orderRef);
      if (match) {
        return finish(
          await this.applyInstallmentNotify({
            orderNumber: match[1],
            installmentNo: Number(match[2]),
            paymentId,
            statusCode,
            payhereAmount,
            payhereCurrency,
            body,
          }),
        );
      }
      return finish('ORDER_NOT_FOUND');
    }
    if (!order.payment) return finish('NO_PAYMENT_RECORD');
    if (order.payment.paymentPlan === PaymentPlan.INSTALLMENT) {
      return finish('INSTALLMENT_PLAN_EXPECTS_INSTALLMENT_REF');
    }

    // 4. Amount must match the order total exactly.
    if (formatPayhereAmount(payhereAmount) !== order.total.toFixed(2)) {
      this.logger.error(
        `PayHere amount mismatch for ${orderRef}: got ${payhereAmount}, expected ${order.total.toFixed(2)}`,
      );
      // A correctly-SIGNED notify with the wrong amount is tampering or a
      // misconfiguration — a human must look at it, not just a log file.
      await this.dispatch.sendAdminAmountMismatch({
        orderNumber: orderRef,
        expectedAmount: order.total.toFixed(2),
        receivedAmount: formatPayhereAmount(payhereAmount),
        currency: payhereCurrency,
        transactionId: paymentId,
      });
      return finish('AMOUNT_MISMATCH');
    }

    // 5. Act on the payment status code.
    if (statusCode === '2') {
      await this.prisma.payment.update({
        where: { orderId: order.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
          transactionId: paymentId,
          gatewayResponse: body as Prisma.InputJsonValue,
        },
      });
      // QA P1-2: money that lands on a CANCELLED order is a refund to make,
      // not a sale — it used to be silently recorded and counted as revenue.
      if (order.status === OrderStatus.CANCELLED) {
        await this.flagPaidAfterCancel({
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: order.total.toFixed(2),
          currency: payhereCurrency || SHOP_CURRENCY,
          transactionId: paymentId,
        });
        return finish('PAID_AFTER_CANCEL');
      }
      await this.ordersService.confirmOrder(order.id); // SALE + CONFIRMED, idempotent
    } else if (['-1', '-2', '-3'].includes(statusCode)) {
      if (order.payment.status !== PaymentStatus.COMPLETED) {
        await this.prisma.payment.update({
          where: { orderId: order.id },
          data: {
            status: PaymentStatus.FAILED,
            gatewayResponse: body as Prisma.InputJsonValue,
          },
        });
        // Tell the customer their payment failed and they can retry.
        await this.dispatch.sendPaymentFailed(order.id);
      }
    }

    return finish();
  }

  /** A verified PayHere notify for `<orderNumber>-I<n>`. Returns a processing error code or undefined. */
  private async applyInstallmentNotify(input: {
    orderNumber: string;
    installmentNo: number;
    paymentId: string;
    statusCode: string;
    payhereAmount: string;
    payhereCurrency: string;
    body: PayhereNotifyBody;
  }): Promise<string | undefined> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: input.orderNumber },
      include: { payment: { include: { installments: true } } },
    });
    if (!order) return 'ORDER_NOT_FOUND';
    if (order.payment?.paymentPlan !== PaymentPlan.INSTALLMENT) {
      return 'NOT_AN_INSTALLMENT_PLAN';
    }
    const installment = order.payment.installments.find(
      (i) => i.installmentNo === input.installmentNo,
    );
    if (!installment) return 'INSTALLMENT_NOT_FOUND';

    if (formatPayhereAmount(input.payhereAmount) !== installment.amount.toFixed(2)) {
      await this.dispatch.sendAdminAmountMismatch({
        orderNumber: `${order.orderNumber} (installment ${installment.installmentNo})`,
        expectedAmount: installment.amount.toFixed(2),
        receivedAmount: formatPayhereAmount(input.payhereAmount),
        currency: input.payhereCurrency,
        transactionId: input.paymentId,
      });
      return 'AMOUNT_MISMATCH';
    }

    if (input.statusCode === '2') {
      if (order.status === OrderStatus.CANCELLED) {
        await this.prisma.installment.updateMany({
          where: { id: installment.id, status: { not: PaymentStatus.COMPLETED } },
          data: {
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(),
            transactionId: input.paymentId,
          },
        });
        await this.flagPaidAfterCancel({
          orderId: order.id,
          orderNumber: `${order.orderNumber} (installment ${installment.installmentNo})`,
          amount: installment.amount.toFixed(2),
          currency: input.payhereCurrency || SHOP_CURRENCY,
          transactionId: input.paymentId,
        });
        return 'PAID_AFTER_CANCEL';
      }
      await this.recordInstallmentPaid(installment.id, {
        transactionId: input.paymentId,
      });
      return undefined;
    }

    if (['-1', '-2', '-3'].includes(input.statusCode)) {
      // The installment simply stays unpaid; the customer can try again.
      await this.dispatch.sendPaymentFailed(order.id);
    }
    return undefined;
  }

  /**
   * QA P1-2: money arrived for an order that was already cancelled. Record the
   * truth (it was paid), keep it OUT of revenue (every revenue query excludes
   * cancelled orders), and make sure a human refunds it: an in-app alert to
   * every admin, an audit row, and an email to ADMIN_ALERT_EMAIL.
   */
  private async flagPaidAfterCancel(input: {
    orderId: string;
    orderNumber: string;
    amount: string;
    currency: string;
    transactionId: string;
  }) {
    this.logger.error(
      `Payment ${input.transactionId} (${input.currency} ${input.amount}) arrived for CANCELLED order ${input.orderNumber} — refund needed`,
    );
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    await this.prisma.$transaction([
      ...(admins.length
        ? [
            this.prisma.notification.createMany({
              data: admins.map((admin) => ({
                userId: admin.id,
                type: 'payment.paid_after_cancel',
                targetId: input.orderId,
                title: `Refund needed: payment on cancelled order ${input.orderNumber}`,
                body: `${input.currency} ${input.amount} was paid (PayHere ${input.transactionId}) after the order was cancelled. It is not counted as revenue — refund the customer.`,
              })),
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: {
          action: 'payment.paid_after_cancel',
          entityType: 'order',
          entityId: input.orderId,
          after: {
            amount: input.amount,
            currency: input.currency,
            transactionId: input.transactionId,
            refundRequired: true,
          },
        },
      }),
    ]);
    await this.dispatch.sendAdminRefundNeeded({
      orderNumber: input.orderNumber,
      amount: input.amount,
      currency: input.currency,
      transactionId: input.transactionId,
    });
  }

  // ─── Cash on Delivery ────────────────────────────────────

  async createCodPayment(orderId: string, userId: string) {
    // QA P1-2: only a PENDING order. A cancelled order used to answer
    // { orderStatus: "CONFIRMED" } while it stayed cancelled in the database.
    const order = await this.findOrderForPayment(orderId, userId);
    if (order.payment?.paymentPlan === PaymentPlan.INSTALLMENT) {
      throw new BadRequestException(
        'This order is on an installment plan — pay the next installment instead',
      );
    }

    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: SHOP_CURRENCY,
        status: PaymentStatus.PENDING, // collected on delivery; admin marks paid later
        method: PaymentMethod.COD,
        paymentPlan: PaymentPlan.FULL,
      },
      update: {
        status: PaymentStatus.PENDING,
        method: PaymentMethod.COD,
        currency: SHOP_CURRENCY,
      },
    });

    // COD confirms the order immediately (deducts stock as a SALE).
    await this.ordersService.confirmOrder(orderId);
    const confirmed = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });

    return {
      orderId,
      method: 'COD',
      // The real status from the database, never an assumed one.
      orderStatus: confirmed.status,
      paymentStatus: payment.status,
    };
  }

  // ─── Admin Payment Management ────────────────────────────

  async getAllPayments(
    page = 1,
    limit = 20,
    filters?: { method?: string; status?: string },
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * l;

    const where: Prisma.PaymentWhereInput = {};
    if (filters?.method) {
      if (filters.method === 'INSTALLMENT') {
        where.paymentPlan = PaymentPlan.INSTALLMENT;
      } else {
        where.method = filters.method as PaymentMethod;
      }
    }
    if (filters?.status) where.status = filters.status as PaymentStatus;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          installments: {
            orderBy: { installmentNo: 'asc' },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
              user: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
      },
    };
  }

  /**
   * Admin marks a payment as received — bank-transfer verification OR
   * COD-collected. Uses the shared idempotent confirmOrder: a still-PENDING
   * order (bank) is confirmed + stock deducted; an already-CONFIRMED order
   * (COD) is a no-op, so it just flips the payment to COMPLETED.
   *
   * QA P1-7: never for an installment plan — that used to mark the WHOLE
   * payment COMPLETED while every installment stayed unpaid. Installments are
   * recorded one at a time (adminMarkInstallmentPaid).
   * QA P1-2: never for a cancelled order.
   */
  async markPaymentPaid(orderId: string, adminId: string, note?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: { select: { status: true } } },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.paymentPlan === PaymentPlan.INSTALLMENT) {
      throw new BadRequestException({
        code: 'INSTALLMENT_PLAN',
        message:
          'This order is on an installment plan. Record each installment from its schedule.',
      });
    }
    if (payment.order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('This order was cancelled');
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment is already completed');
    }

    await this.prisma.payment.update({
      where: { orderId },
      data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
    });
    await this.ordersService.confirmOrder(orderId, adminId, note);

    // Unconditional write: confirmOrder's own history write only happens on
    // the bank-pending edge (order still PENDING). On the "mark collected"
    // edge the order is already CONFIRMED, so confirmOrder no-ops and writes
    // nothing — without this, a note entered here would be accepted by the
    // API and then silently vanish.
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'payment.mark_paid',
        entityType: 'payment',
        entityId: payment.id,
        after: { note: note ?? null },
      },
    });

    return this.prisma.payment.findUnique({ where: { orderId } });
  }

  /** QA P1-7: an admin records ONE installment received (cash / bank transfer). */
  async adminMarkInstallmentPaid(
    installmentId: string,
    adminId: string,
    note?: string,
  ) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: { payment: { include: { order: { select: { status: true } } } } },
    });
    if (!installment) throw new NotFoundException('Installment not found');
    if (installment.payment.order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('This order was cancelled');
    }
    if (installment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('This installment is already paid');
    }
    if (installment.status === PaymentStatus.FAILED) {
      throw new BadRequestException('This installment was voided');
    }

    const result = await this.recordInstallmentPaid(installmentId);

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'installment.mark_paid',
        entityType: 'installment',
        entityId: installmentId,
        after: {
          installmentNo: installment.installmentNo,
          amount: installment.amount.toFixed(2),
          note: note ?? null,
        },
      },
    });

    return result;
  }

  /** Admin rejects a payment (e.g. an invalid bank slip). Reservation is kept;
   *  the admin cancels the order separately to release stock if needed. */
  async rejectPayment(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Cannot reject a completed payment');
    }

    const updated = await this.prisma.payment.update({
      where: { orderId },
      data: { status: PaymentStatus.FAILED },
    });

    // Previously a silent rejection — the customer found out only by checking
    // their order page. (The missing AuditLog write here is a separate,
    // pre-existing gap, tracked but not fixed in this pass.)
    await this.dispatch.sendPaymentRejected(orderId);

    return updated;
  }

  // ─── Helpers ────────────────────────────────────────────

  /**
   * The order a customer is about to pay for. QA P1-2: it must be theirs AND
   * still PENDING — payments used to be created for cancelled orders.
   */
  private async findOrderForPayment(
    orderId: string,
    userId: string,
    opts: { includeUser?: boolean } = {},
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true, user: opts.includeUser ?? false },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is already fully paid');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException({
        code: 'ORDER_NOT_PAYABLE',
        message:
          order.status === OrderStatus.CANCELLED
            ? 'This order was cancelled and can no longer be paid. Please place a new order.'
            : 'This order is no longer awaiting payment.',
      });
    }

    return order;
  }

  private payhereMerchant() {
    const merchantId = this.configService.get<string>('PAYHERE_MERCHANT_ID');
    const merchantSecret = this.configService.get<string>(
      'PAYHERE_MERCHANT_SECRET',
    );
    if (!merchantId || !merchantSecret) {
      throw new BadRequestException('PayHere is not configured');
    }
    return { merchantId, merchantSecret };
  }

  private buildPayhereCheckout(input: {
    merchant: { merchantId: string; merchantSecret: string };
    orderRef: string;
    amount: string;
    itemsLabel: string;
    user: {
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    };
    shippingAddress: Prisma.JsonValue;
    returnPath: string;
    cancelPath: string;
  }) {
    // PayHere's checkout requires a well-formed email and non-empty
    // address/city — this platform allows phone-only accounts (dual
    // identity), so a customer can reach here with no email on file.
    // Sending a blank email/address gets rejected by PayHere's checkout
    // guard as "Unauthorized payment request" rather than a clear,
    // field-specific error, so fail fast here with an actionable message.
    if (!input.user.email) {
      throw new BadRequestException(
        'PayHere card payments require an email address on your account. Add one in your profile, or choose Cash on Delivery.',
      );
    }
    const shippingAddress = input.shippingAddress as {
      addressLine1?: string;
      city?: string;
    } | null;
    if (!shippingAddress?.addressLine1 || !shippingAddress?.city) {
      throw new BadRequestException(
        'A shipping address with address line and city is required for card payment',
      );
    }

    const hash = payhereCheckoutHash({
      merchantId: input.merchant.merchantId,
      orderId: input.orderRef,
      amount: input.amount,
      currency: SHOP_CURRENCY,
      merchantSecret: input.merchant.merchantSecret,
    });
    const mode = this.configService.get<string>('PAYHERE_MODE') || 'sandbox';
    const checkoutUrl =
      mode === 'live'
        ? 'https://www.payhere.lk/pay/checkout'
        : 'https://sandbox.payhere.lk/pay/checkout';
    const frontend =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const notifyUrl =
      this.configService.get<string>('PAYHERE_NOTIFY_URL') ||
      'http://localhost:3001/api/v1/payments/payhere/notify';

    return {
      checkoutUrl,
      params: {
        merchant_id: input.merchant.merchantId,
        return_url: `${frontend}${input.returnPath}`,
        cancel_url: `${frontend}${input.cancelPath}`,
        notify_url: notifyUrl,
        order_id: input.orderRef,
        items: input.itemsLabel,
        currency: SHOP_CURRENCY,
        amount: input.amount,
        first_name: input.user.firstName,
        last_name: input.user.lastName,
        email: input.user.email,
        phone: input.user.phone ?? '',
        address: shippingAddress.addressLine1,
        city: shippingAddress.city,
        country: 'Sri Lanka',
        hash,
      },
    };
  }

  /** Unique violation, whether surfaced by the Prisma engine or a driver adapter. */
  private isUniqueViolation(e: unknown): boolean {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return e.code === 'P2002';
    }
    return /unique constraint|23505/i.test(
      e instanceof Error ? e.message : String(e),
    );
  }
}
