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
  let prisma: {
    payment: { findUnique: jest.Mock; update: jest.Mock };
    installment: { findUnique: jest.Mock; update: jest.Mock };
    paymentWebhookEvent: { create: jest.Mock; updateMany: jest.Mock };
    order: { findUnique: jest.Mock };
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
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      order: { findUnique: jest.fn() },
    };
    dispatch = mockDispatch();

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
        { provide: OrdersService, useValue: { confirmOrder: jest.fn() } },
        { provide: NotificationDispatchService, useValue: dispatch },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
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
