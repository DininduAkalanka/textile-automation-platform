import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

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
