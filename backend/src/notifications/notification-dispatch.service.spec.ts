import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { NotificationDispatchService } from './notification-dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';

const makeOrder = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  orderNumber: 'TXL-1',
  subtotal: new Prisma.Decimal(3000),
  shippingCost: new Prisma.Decimal(0),
  tax: new Prisma.Decimal(0),
  total: new Prisma.Decimal(3000),
  user: {
    email: 'a@b.com',
    phone: '+94771234567',
    firstName: 'Jane',
    lastName: 'Doe',
  },
  items: [
    {
      quantity: 2,
      unitPrice: new Prisma.Decimal(1500),
      totalPrice: new Prisma.Decimal(3000),
      product: { name: 'Cotton Shirt' },
    },
  ],
  ...over,
});

describe('NotificationDispatchService', () => {
  let service: NotificationDispatchService;
  let prisma: { order: { findUnique: jest.Mock } };
  let email: { send: jest.Mock };
  let sms: { send: jest.Mock };
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    prisma = { order: { findUnique: jest.fn() } };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };
    env = { FRONTEND_URL: 'http://localhost:3000' };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: SmsService, useValue: sms },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();
    service = moduleRef.get(NotificationDispatchService);
  });

  describe('sendOrderConfirmation', () => {
    it('prefers a rich email when the customer has one', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder());

      await service.sendOrderConfirmation('o1');

      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.com',
          subject: 'Order TXL-1 confirmed',
          react: expect.anything(),
        }),
      );
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('falls back to a concise SMS for a phone-only customer', async () => {
      prisma.order.findUnique.mockResolvedValue(
        makeOrder({
          user: {
            email: null,
            phone: '+94771234567',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        }),
      );

      await service.sendOrderConfirmation('o1');

      expect(email.send).not.toHaveBeenCalled();
      expect(sms.send).toHaveBeenCalledWith(
        '+94771234567',
        expect.stringContaining('TXL-1'),
      );
    });

    it('never throws — even when the order lookup itself fails', async () => {
      prisma.order.findUnique.mockRejectedValue(new Error('db down'));
      await expect(
        service.sendOrderConfirmation('o1'),
      ).resolves.toBeUndefined();
    });

    it('no-ops for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await service.sendOrderConfirmation('nope');
      expect(email.send).not.toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  describe('payment problems', () => {
    it('emails a payment-failed notice', async () => {
      prisma.order.findUnique.mockResolvedValue(makeOrder());
      await service.sendPaymentFailed('o1');
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("didn't go through"),
        }),
      );
    });

    it('SMS-falls-back the rejected notice for phone-only customers', async () => {
      prisma.order.findUnique.mockResolvedValue(
        makeOrder({
          user: { email: null, phone: '+94771234567', firstName: 'Jane' },
        }),
      );
      await service.sendPaymentRejected('o1');
      expect(sms.send).toHaveBeenCalledWith(
        '+94771234567',
        expect.stringContaining("couldn't verify"),
      );
    });
  });

  describe('sendAdminAmountMismatch', () => {
    const input = {
      orderNumber: 'TXL-1',
      expectedAmount: '1000.00',
      receivedAmount: '900.00',
      currency: 'LKR',
      transactionId: 'PH-1',
    };

    it('emails the configured admin address', async () => {
      env.ADMIN_ALERT_EMAIL = 'admin@shop.test';
      await service.sendAdminAmountMismatch(input);
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@shop.test' }),
      );
    });

    it('skips (with a log, not a crash) when ADMIN_ALERT_EMAIL is unset', async () => {
      delete env.ADMIN_ALERT_EMAIL;
      await expect(
        service.sendAdminAmountMismatch(input),
      ).resolves.toBeUndefined();
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
