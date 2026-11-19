import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { payhereNotifySig } from './payhere.util';

const mockDispatch = () => ({
  sendPaymentFailed: jest.fn(),
  sendPaymentRejected: jest.fn(),
  sendAdminAmountMismatch: jest.fn(),
  sendAdminRefundNeeded: jest.fn(),
  sendOrderConfirmation: jest.fn(),
});

/**
 * Regression tests for the payment IDOR fix: a customer must only ever read or
 * confirm payments belonging to their own order. Cross-user access returns 404
 * (not 403) so we never leak whether another user's payment exists. The
 * server-trusted webhook path (no userId) is intentionally exempt.
 */
describe('PaymentsService — object-level authorization (IDOR guards)', () => {
  let service: PaymentsService;
  let prisma: {
    payment: { findUnique: jest.Mock; update: jest.Mock };
    installment: { findUnique: jest.Mock; update: jest.Mock };
  };

  const ownedPayment = {
    id: 'pay1',
    installments: [],
    order: {
      id: 'o1',
      userId: 'owner',
      orderNumber: 'TXL-1',
      total: new Prisma.Decimal(1000),
      status: 'PENDING',
    },
  };

  beforeEach(async () => {
    prisma = {
      payment: { findUnique: jest.fn(), update: jest.fn() },
      installment: { findUnique: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        // No Stripe key -> service stays in mock mode, no network/SDK init.
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: OrdersService, useValue: { confirmOrder: jest.fn() } },
        { provide: NotificationDispatchService, useValue: mockDispatch() },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  describe('getPaymentByOrderId', () => {
    it('returns the payment for its owner', async () => {
      prisma.payment.findUnique.mockResolvedValue(ownedPayment);
      await expect(service.getPaymentByOrderId('o1', 'owner')).resolves.toBe(
        ownedPayment,
      );
    });

    it('hides a payment owned by a different user (404, no existence leak)', async () => {
      prisma.payment.findUnique.mockResolvedValue(ownedPayment);
      await expect(
        service.getPaymentByOrderId('o1', 'attacker'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows an admin to read any payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(ownedPayment);
      await expect(
        service.getPaymentByOrderId('o1', 'admin', true),
      ).resolves.toBe(ownedPayment);
    });

    it('404s when the payment does not exist', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.getPaymentByOrderId('o1', 'owner'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getInstallmentSchedule', () => {
    it('hides another user schedule', async () => {
      prisma.payment.findUnique.mockResolvedValue(ownedPayment);
      await expect(
        service.getInstallmentSchedule('o1', 'attacker'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmPayment', () => {
    it('refuses to confirm another user order and performs no write', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay1',
        installments: [],
        order: { userId: 'owner' },
      });

      await expect(
        service.confirmPayment('o1', 'attacker'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmInstallment', () => {
    it('refuses to confirm an installment on another user order', async () => {
      prisma.installment.findUnique.mockResolvedValue({
        id: 'i1',
        payment: { installments: [], order: { userId: 'owner' } },
      });

      await expect(
        service.confirmInstallment('i1', 'attacker'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.installment.update).not.toHaveBeenCalled();
    });
  });
});

/**
 * Outbound notification hooks: a failed/mismatched/rejected payment must tell
 * someone (customer or admin), and only through the never-throws dispatcher.
 */
describe('PaymentsService — outbound dispatch hooks', () => {
  const MERCHANT_ID = 'M-TEST-1';
  const SECRET = 'test-merchant-secret';

  let service: PaymentsService;
  let dispatch: ReturnType<typeof mockDispatch>;
  let orders: { confirmOrder: jest.Mock };
  let prisma: {
    payment: { findUnique: jest.Mock; update: jest.Mock };
    installment: { findUnique: jest.Mock; update: jest.Mock };
    paymentWebhookEvent: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    order: { findUnique: jest.Mock };
    user: { findMany: jest.Mock };
    notification: { createMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  /** A correctly-signed PayHere notify body (signature computed like the gateway does). */
  const notifyBody = (over: Record<string, string> = {}) => {
    const base = {
      merchant_id: MERCHANT_ID,
      order_id: 'TXL-1',
      payment_id: 'PH-1',
      payhere_amount: '1000.00',
      payhere_currency: 'LKR',
      status_code: '-1',
      ...over,
    };
    return {
      ...base,
      md5sig: payhereNotifySig({
        merchantId: base.merchant_id,
        orderId: base.order_id,
        payhereAmount: base.payhere_amount,
        payhereCurrency: base.payhere_currency,
        statusCode: base.status_code,
        merchantSecret: SECRET,
      }),
    };
  };

  beforeEach(async () => {
    prisma = {
      payment: { findUnique: jest.fn(), update: jest.fn() },
      installment: { findUnique: jest.fn(), update: jest.fn() },
      paymentWebhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt1' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
      order: { findUnique: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin1' }]) },
      notification: { createMany: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    };
    dispatch = mockDispatch();
    orders = { confirmOrder: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                PAYHERE_MERCHANT_ID: MERCHANT_ID,
                PAYHERE_MERCHANT_SECRET: SECRET,
              })[key],
          },
        },
        { provide: OrdersService, useValue: orders },
        { provide: NotificationDispatchService, useValue: dispatch },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  // ─── QA P1-1 ──────────────────────────────────────────────────────────
  it('stores a forged notify as an unverified audit row and changes nothing', async () => {
    const forged = { ...notifyBody({ status_code: '2' }), md5sig: 'F'.repeat(32) };

    await expect(service.handlePayhereNotify(forged)).resolves.toEqual({
      received: true,
    });

    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        signatureValid: false,
        processed: true,
        processingError: 'INVALID_SIGNATURE',
      }),
    });
    // A forged event never resolves an order, never moves money.
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(orders.confirmOrder).not.toHaveBeenCalled();
  });

  it('rejects a notify with no payment_id and stores nothing (no junk rows)', async () => {
    const body: Record<string, string> = notifyBody({ status_code: '2' });
    delete body.payment_id;

    await expect(service.handlePayhereNotify(body)).rejects.toThrow(
      'Malformed PayHere notification',
    );
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('reprocesses a verified event that was stored but never finished', async () => {
    const { Prisma: P } = jest.requireActual('@prisma/client');
    prisma.paymentWebhookEvent.create.mockRejectedValueOnce(
      new P.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.paymentWebhookEvent.findFirst.mockResolvedValue({
      id: 'evt-earlier',
      processed: false,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      total: new Prisma.Decimal(1000),
      payment: { id: 'pay1', paymentPlan: 'FULL', status: 'PENDING' },
    });

    await service.handlePayhereNotify(notifyBody({ status_code: '2' }));

    expect(orders.confirmOrder).toHaveBeenCalledWith('o1');
    expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'evt-earlier' } }),
    );
  });

  // ─── QA P1-2 ──────────────────────────────────────────────────────────
  it('flags money on a CANCELLED order for refund instead of confirming it', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      orderNumber: 'TXL-1',
      status: 'CANCELLED',
      total: new Prisma.Decimal(1000),
      payment: { id: 'pay1', paymentPlan: 'FULL', status: 'FAILED' },
    });

    await service.handlePayhereNotify(notifyBody({ status_code: '2' }));

    expect(orders.confirmOrder).not.toHaveBeenCalled();
    expect(dispatch.sendAdminRefundNeeded).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 'TXL-1', amount: '1000.00' }),
    );
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'admin1',
          type: 'payment.paid_after_cancel',
        }),
      ],
    });
    expect(prisma.paymentWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt1' },
      data: { processed: true, processingError: 'PAID_AFTER_CANCEL' },
    });
  });

  it('notifies the customer when the gateway reports a failed payment', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      total: new Prisma.Decimal(1000),
      payment: { id: 'pay1' },
    });

    await service.handlePayhereNotify(notifyBody({ status_code: '-1' }));

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    expect(dispatch.sendPaymentFailed).toHaveBeenCalledWith('o1');
  });

  it('alerts the admin on a signed-but-wrong-amount webhook and changes nothing', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      total: new Prisma.Decimal(1000), // order says 1000…
      payment: { id: 'pay1' },
    });

    // …but the (correctly signed) notify claims 900 was paid.
    await service.handlePayhereNotify(
      notifyBody({ payhere_amount: '900.00', status_code: '2' }),
    );

    expect(dispatch.sendAdminAmountMismatch).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: 'TXL-1',
        expectedAmount: '1000.00',
        receivedAmount: '900.00',
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(dispatch.sendPaymentFailed).not.toHaveBeenCalled();
  });

  // ─── QA P1-7 ──────────────────────────────────────────────────────────
  it.each([0, -2, 2.5, 7, 500, Number.NaN])(
    'refuses an installment plan of %p payments',
    async (count) => {
      await expect(
        service.createInstallmentPayment('o1', 'owner', count),
      ).rejects.toThrow('between 2 and 6 payments');
    },
  );

  it('refuses to mark a whole installment plan paid in one click', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      status: 'PENDING',
      paymentPlan: 'INSTALLMENT',
      order: { status: 'PENDING' },
    });

    await expect(service.markPaymentPaid('o1', 'admin1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INSTALLMENT_PLAN' }),
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(orders.confirmOrder).not.toHaveBeenCalled();
  });

  it('notifies the customer when an admin rejects their payment', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay1',
      status: 'PENDING',
    });
    prisma.payment.update.mockResolvedValue({ id: 'pay1', status: 'FAILED' });

    await service.rejectPayment('o1');

    expect(dispatch.sendPaymentRejected).toHaveBeenCalledWith('o1');
  });
});
