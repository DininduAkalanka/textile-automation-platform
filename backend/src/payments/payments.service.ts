import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import {
  PaymentStatus,
  PaymentMethod,
  PaymentPlan,
  Installment,
  Prisma,
} from '@prisma/client';
import Stripe from 'stripe';
import {
  payhereCheckoutHash,
  payhereNotifySig,
  formatPayhereAmount,
} from './payhere.util';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private ordersService: OrdersService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey && stripeKey !== 'sk_test_mock') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
      this.logger.log('Stripe SDK initialized');
    } else {
      this.logger.warn('Stripe SDK not initialized — using mock payments');
    }
  }

  // ─── Full Payment ────────────────────────────────────────

  async createFullPayment(orderId: string, userId: string) {
    const order = await this.findOrderForPayment(orderId, userId);

    // Create a Stripe PaymentIntent or mock one
    let clientSecret: string;
    let stripePaymentIntentId: string | null = null;

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100), // cents
        currency: 'usd',
        metadata: { orderId, userId, paymentPlan: 'FULL' },
      });
      clientSecret = paymentIntent.client_secret!;
      stripePaymentIntentId = paymentIntent.id;
    } else {
      clientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`;
      stripePaymentIntentId = `pi_mock_${Date.now()}`;
    }

    // Create payment record
    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        method: PaymentMethod.STRIPE,
        paymentPlan: PaymentPlan.FULL,
        transactionId: stripePaymentIntentId,
      },
      update: {
        status: PaymentStatus.PENDING,
        transactionId: stripePaymentIntentId,
        paymentPlan: PaymentPlan.FULL,
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

  // ─── Installment Payment ────────────────────────────────

  async createInstallmentPayment(
    orderId: string,
    userId: string,
    installmentCount: number,
  ) {
    const order = await this.findOrderForPayment(orderId, userId);

    const totalAmount = Number(order.total);
    const installmentAmount =
      Math.floor((totalAmount * 100) / installmentCount) / 100;
    // The last installment absorbs any rounding remainder
    const lastInstallmentAmount =
      Math.round(
        (totalAmount - installmentAmount * (installmentCount - 1)) * 100,
      ) / 100;

    // Create a Stripe PaymentIntent for the FIRST installment
    let clientSecret: string;
    let stripePaymentIntentId: string | null = null;

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(installmentAmount * 100),
        currency: 'usd',
        metadata: {
          orderId,
          userId,
          paymentPlan: 'INSTALLMENT',
          installmentNo: '1',
          totalInstallments: String(installmentCount),
        },
      });
      clientSecret = paymentIntent.client_secret!;
      stripePaymentIntentId = paymentIntent.id;
    } else {
      clientSecret = `pi_mock_inst_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`;
      stripePaymentIntentId = `pi_mock_inst_${Date.now()}`;
    }

    // Create payment record with installments in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert payment
      const payment = await tx.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          amount: order.total,
          currency: 'USD',
          status: PaymentStatus.PENDING,
          method: PaymentMethod.INSTALLMENT,
          paymentPlan: PaymentPlan.INSTALLMENT,
          installmentCount,
          transactionId: stripePaymentIntentId,
        },
        update: {
          status: PaymentStatus.PENDING,
          method: PaymentMethod.INSTALLMENT,
          paymentPlan: PaymentPlan.INSTALLMENT,
          installmentCount,
          transactionId: stripePaymentIntentId,
        },
      });

      // Delete existing installments if re-creating
      await tx.installment.deleteMany({ where: { paymentId: payment.id } });

      // Create installment records
      const now = new Date();
      const installments: Installment[] = [];
      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + (i - 1)); // Monthly intervals

        const amount =
          i === installmentCount ? lastInstallmentAmount : installmentAmount;

        const installment = await tx.installment.create({
          data: {
            paymentId: payment.id,
            installmentNo: i,
            amount,
            dueDate,
            status: i === 1 ? PaymentStatus.PENDING : PaymentStatus.PENDING,
            stripePaymentId: i === 1 ? stripePaymentIntentId : null,
          },
        });
        installments.push(installment);
      }

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
      clientSecret,
      firstInstallmentAmount: installmentAmount,
      installments: result.installments.map((inst) => ({
        id: inst.id,
        installmentNo: inst.installmentNo,
        amount: inst.amount,
        dueDate: inst.dueDate,
        status: inst.status,
      })),
    };
  }

  // ─── Pay Individual Installment ──────────────────────────

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

    // Create Stripe PaymentIntent for this installment
    let clientSecret: string;
    let stripePaymentIntentId: string | null = null;

    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(installment.amount) * 100),
        currency: 'usd',
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

    // Update installment with new stripe payment id
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

  // ─── Confirm Payment (called after Stripe confirms) ─────

  async confirmPayment(orderId: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { installments: true, order: { select: { userId: true } } },
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
      // Full payment: mark it completed, then confirm the order via the shared
      // path (deducts stock as a SALE + writes status history, idempotently).
      const updatedPayment = await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });
      await this.ordersService.confirmOrder(orderId);
      return updatedPayment;
    } else {
      // Installment: mark first installment as completed, confirm order
      const firstInstallment = payment.installments.find(
        (inst) => inst.installmentNo === 1,
      );

      if (firstInstallment) {
        await this.prisma.installment.update({
          where: { id: firstInstallment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(),
          },
        });
      }

      const updatedPayment = await this.prisma.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.PENDING, // Overall still pending (not all installments paid)
        },
        include: { installments: true },
      });

      // First installment paid — confirm the order (SALE + history, idempotent).
      await this.ordersService.confirmOrder(orderId);

      return updatedPayment;
    }
  }

  // ─── Confirm Individual Installment ─────────────────────

  async confirmInstallment(installmentId: string, userId?: string) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: {
            installments: true,
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

    // Mark installment as completed
    await this.prisma.installment.update({
      where: { id: installmentId },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      },
    });

    // Check if all installments are now completed
    const allInstallments = installment.payment.installments;
    const pendingCount = allInstallments.filter(
      (inst) =>
        inst.id !== installmentId && inst.status !== PaymentStatus.COMPLETED,
    ).length;

    if (pendingCount === 0) {
      // All installments paid — mark payment as completed
      await this.prisma.payment.update({
        where: { id: installment.paymentId },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });
    }

    return { success: true, allPaid: pendingCount === 0 };
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
      totalAmount: payment.amount,
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
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata;

        if (metadata.installmentId) {
          // Installment payment confirmed
          await this.confirmInstallment(metadata.installmentId);
        } else if (metadata.orderId) {
          // Full or first-installment payment confirmed
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
    const merchantId = this.configService.get<string>('PAYHERE_MERCHANT_ID');
    const merchantSecret = this.configService.get<string>(
      'PAYHERE_MERCHANT_SECRET',
    );
    if (!merchantId || !merchantSecret) {
      throw new BadRequestException('PayHere is not configured');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { user: true, payment: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.payment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is already fully paid');
    }

    const amount = order.total.toFixed(2);
    const currency = 'LKR';
    const orderRef = order.orderNumber;

    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYHERE,
        paymentPlan: PaymentPlan.FULL,
      },
      update: {
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYHERE,
        currency,
      },
    });

    const hash = payhereCheckoutHash({
      merchantId,
      orderId: orderRef,
      amount,
      currency,
      merchantSecret,
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
        merchant_id: merchantId,
        return_url: `${frontend}/payment/success?orderId=${orderId}`,
        cancel_url: `${frontend}/payment/cancel?orderId=${orderId}`,
        notify_url: notifyUrl,
        order_id: orderRef,
        items: `Order ${orderRef}`,
        currency,
        amount,
        first_name: order.user.firstName,
        last_name: order.user.lastName,
        email: order.user.email,
        phone: order.user.phone ?? '',
        address: '',
        city: '',
        country: 'Sri Lanka',
        hash,
      },
    };
  }

  /**
   * PayHere server-to-server notify. Assume it arrives multiple times: every
   * event is persisted first; the unique (gateway, transaction_id, event_status)
   * constraint makes reprocessing a no-op (D5). Signature and amount are verified
   * before any state change; confirmation runs through the shared confirmOrder.
   */
  async handlePayhereNotify(body: any) {
    const merchantId = this.configService.get<string>('PAYHERE_MERCHANT_ID');
    const merchantSecret =
      this.configService.get<string>('PAYHERE_MERCHANT_SECRET') ?? '';

    const orderId = String(body?.order_id ?? '');
    const paymentId = body?.payment_id ? String(body.payment_id) : null;
    const statusCode = String(body?.status_code ?? '');
    const payhereAmount = String(body?.payhere_amount ?? '');
    const payhereCurrency = String(body?.payhere_currency ?? '');
    const md5sig = body?.md5sig ? String(body.md5sig) : '';

    const localSig = merchantSecret
      ? payhereNotifySig({
          merchantId: String(body?.merchant_id ?? ''),
          orderId,
          payhereAmount,
          payhereCurrency,
          statusCode,
          merchantSecret,
        })
      : '';
    const signatureValid =
      !!md5sig &&
      localSig === md5sig.toUpperCase() &&
      String(body?.merchant_id ?? '') === merchantId;

    // 1. Persist the raw event first (idempotency + audit).
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          gateway: 'payhere',
          transactionId: paymentId,
          eventStatus: statusCode,
          payload: body,
          signature: md5sig || null,
          signatureValid,
          processed: false,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Duplicate delivery — already recorded. Acknowledge, change nothing.
        return { received: true, duplicate: true };
      }
      throw e;
    }

    const finish = async (error?: string) => {
      await this.prisma.paymentWebhookEvent.updateMany({
        where: {
          gateway: 'payhere',
          transactionId: paymentId,
          eventStatus: statusCode,
        },
        data: { processed: true, processingError: error ?? null },
      });
      return { received: true };
    };

    // 2. Bad signature — never leak validity, no state change.
    if (!signatureValid) {
      this.logger.warn(
        `PayHere notify with invalid signature (order ${orderId})`,
      );
      return finish('INVALID_SIGNATURE');
    }

    // 3. Resolve the order by its human order number.
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { payment: true },
    });
    if (!order) return finish('ORDER_NOT_FOUND');
    if (!order.payment) return finish('NO_PAYMENT_RECORD');

    // 4. Amount must match the order total exactly.
    if (formatPayhereAmount(payhereAmount) !== order.total.toFixed(2)) {
      this.logger.error(
        `PayHere amount mismatch for ${orderId}: got ${payhereAmount}, expected ${order.total.toFixed(2)}`,
      );
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
          gatewayResponse: body,
        },
      });
      await this.ordersService.confirmOrder(order.id); // SALE + CONFIRMED, idempotent
    } else if (['-1', '-2', '-3'].includes(statusCode)) {
      await this.prisma.payment.update({
        where: { orderId: order.id },
        data: { status: PaymentStatus.FAILED, gatewayResponse: body },
      });
    }

    return finish();
  }

  // ─── Cash on Delivery ────────────────────────────────────

  async createCodPayment(orderId: string, userId: string) {
    const order = await this.findOrderForPayment(orderId, userId);

    const payment = await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: order.total,
        currency: 'LKR',
        status: PaymentStatus.PENDING, // collected on delivery; admin marks paid later
        method: PaymentMethod.COD,
        paymentPlan: PaymentPlan.FULL,
      },
      update: {
        status: PaymentStatus.PENDING,
        method: PaymentMethod.COD,
        currency: 'LKR',
      },
    });

    // COD confirms the order immediately (deducts stock as a SALE).
    await this.ordersService.confirmOrder(orderId);

    return {
      orderId,
      method: 'COD',
      orderStatus: 'CONFIRMED',
      paymentStatus: payment.status,
    };
  }

  // ─── Admin Payment Management ────────────────────────────

  async getAllPayments(
    page = 1,
    limit = 20,
    filters?: { method?: string; status?: string },
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const where: Prisma.PaymentWhereInput = {};
    if (filters?.method) where.method = filters.method as PaymentMethod;
    if (filters?.status) where.status = filters.status as PaymentStatus;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
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
   */
  async markPaymentPaid(orderId: string, adminId: string, note?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
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

    return this.prisma.payment.update({
      where: { orderId },
      data: { status: PaymentStatus.FAILED },
    });
  }

  // ─── Helpers ────────────────────────────────────────────

  private async findOrderForPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is already fully paid');
    }

    return order;
  }
}
