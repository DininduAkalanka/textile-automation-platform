import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma, PaymentMethod } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionService } from '../production/production.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';

/**
 * Unit tests for order creation after the inventory-ledger rewire (D3).
 * create() reserves stock via InventoryService (race-safe guarded UPDATE) and
 * writes the opening status-history row; it no longer decrements product stock
 * directly. The SALE/release/reconciliation paths use raw SQL and are covered
 * end-to-end against a real DB rather than mocked here.
 */
describe('OrdersService — reserve on create (D3)', () => {
  let service: OrdersService;
  let prisma: {
    product: { findMany: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
    order: { count: jest.Mock; findUniqueOrThrow: jest.Mock };
    payment: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let inventory: {
    reserve: jest.Mock;
    reserveSize: jest.Mock;
    sale: jest.Mock;
    release: jest.Mock;
    restock: jest.Mock;
  };
  let production: { createTasksForOrder: jest.Mock };
  let tx: {
    order: { create: jest.Mock };
    orderStatusHistory: { create: jest.Mock };
    product: { update: jest.Mock };
  };

  const makeProduct = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    name: 'Cotton Shirt',
    price: new Prisma.Decimal(1000),
    stockQuantity: 5, // sellable cache = available - reserved
    isActive: true,
    ...over,
  });

  const dto = {
    items: [{ productId: 'p1', quantity: 2 }],
    shippingAddress: { line1: '1 Galle Rd' },
  } as any;

  beforeEach(async () => {
    tx = {
      order: { create: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      product: { update: jest.fn() },
    };
    inventory = {
      reserve: jest.fn(),
      reserveSize: jest.fn(),
      sale: jest.fn(),
      release: jest.fn(),
      restock: jest.fn(),
    };
    prisma = {
      product: { findMany: jest.fn(), update: jest.fn() },
      // Checkout gate: default to a verified customer so the create() tests
      // below exercise the reservation path, not the gate.
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ emailVerified: true, phoneVerified: false }),
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({}),
      },
      // Open unpaid orders for the account / IP (QA P0-2 caps). 0 = room.
      order: {
        count: jest.fn().mockResolvedValue(0),
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(({ where }: any) =>
            Promise.resolve({ id: where.id, total: new Prisma.Decimal(1000) }),
          ),
      },
      payment: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    // confirmOrder fires the ProductionTrigger (D8). These tests only exercise
    // create(), which never calls it, so a stub is enough — the trigger itself is
    // covered against a real database in test/production.e2e-spec.ts.
    production = { createTasksForOrder: jest.fn().mockResolvedValue(0) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventory },
        { provide: ProductionService, useValue: production },
        // confirmOrder's post-commit email dispatch; create() never calls it.
        {
          provide: NotificationDispatchService,
          useValue: { sendOrderConfirmation: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('reserves stock and records the opening PENDING transition on success', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    tx.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'TXL-1' });

    const result = await service.create('u1', dto);

    expect(result).toEqual({ id: 'o1', orderNumber: 'TXL-1' });
    expect(inventory.reserve).toHaveBeenCalledWith(
      tx,
      'p1',
      2,
      'o1',
      'Cotton Shirt',
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'o1',
          fromStatus: null,
          toStatus: 'PENDING',
        }),
      }),
    );
  });

  it('blocks checkout when the customer has no verified contact (email or phone)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      emailVerified: false,
      phoneVerified: false,
    });

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Fails at the gate, before touching products or stock.
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows checkout when only the phone is verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      emailVerified: false,
      phoneVerified: true,
    });
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    tx.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'TXL-1' });

    await expect(service.create('u1', dto)).resolves.toEqual({
      id: 'o1',
      orderNumber: 'TXL-1',
    });
  });

  it('rejects before opening a transaction when sellable stock is short (fast pre-check)', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ stockQuantity: 1 }),
    ]);

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(inventory.reserve).not.toHaveBeenCalled();
  });

  it('propagates the reservation failure when the guarded UPDATE matches 0 rows (race lost)', async () => {
    // Passes the JS pre-check (looks like 5) but a concurrent order took the
    // stock first, so reserve() throws — the whole order creation must abort.
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ stockQuantity: 5 }),
    ]);
    tx.order.create.mockResolvedValue({ id: 'o1' });
    inventory.reserve.mockRejectedValue(
      new BadRequestException('Insufficient stock'),
    );

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException when selected size is out of stock', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({
        stockQuantity: 10,
        attributes: {
          sizeStock: { S: 5, M: 0, L: 5 },
        },
      }),
    ]);

    await expect(
      service.create('u1', {
        items: [
          {
            productId: 'p1',
            quantity: 1,
            selectedAttributes: { size: 'M' },
          },
        ],
        shippingAddress: { line1: '1 Galle Rd' },
      } as any),
    ).rejects.toThrow(
      'Insufficient stock for size "M" of "Cotton Shirt". Available: 0',
    );
  });

  it('reserves per-size stock through the guarded UPDATE and records selectedAttributes (QA P1-6)', async () => {
    const prod = makeProduct({
      stockQuantity: 10,
      attributes: {
        sizeStock: { S: 5, M: 3, L: 2 },
      },
    });
    prisma.product.findMany.mockResolvedValue([prod]);
    tx.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'TXL-1' });

    await service.create('u1', {
      items: [
        {
          productId: 'p1',
          quantity: 2,
          selectedAttributes: { size: 'M' },
        },
      ],
      shippingAddress: { line1: '1 Galle Rd' },
    } as any);

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                productId: 'p1',
                quantity: 2,
                selectedAttributes: { size: 'M' },
              }),
            ]),
          },
        }),
      }),
    );
    // One guarded UPDATE inside the transaction — never a read-modify-write
    // of the whole attributes object (the oversell bug).
    expect(inventory.reserveSize).toHaveBeenCalledWith(
      tx,
      'p1',
      'M',
      2,
      'Cotton Shirt',
    );
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('rejects a size the product does not stock (QA P1-6)', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ stockQuantity: 10, attributes: { sizeStock: { S: 5, M: 3 } } }),
    ]);
    await expect(
      service.create('u1', {
        items: [{ productId: 'p1', quantity: 1, selectedAttributes: { size: 'XXXXXXL' } }],
        shippingAddress: { line1: '1 Galle Rd' },
      } as any),
    ).rejects.toThrow('Size "XXXXXXL" is not available for "Cotton Shirt"');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a size when the product tracks per-size stock', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ stockQuantity: 10, attributes: { sizeStock: { S: 5 } } }),
    ]);
    await expect(service.create('u1', dto)).rejects.toThrow(
      'Choose a size for "Cotton Shirt"',
    );
  });

  it('rejects unknown attribute keys (QA P2-3)', async () => {
    await expect(
      service.create('u1', {
        items: [{ productId: 'p1', quantity: 1, selectedAttributes: { price: 1 } }],
        shippingAddress: { line1: '1 Galle Rd' },
      } as any),
    ).rejects.toThrow('Unknown order attribute "price"');
  });

  it('accepts the same product twice in different sizes (QA P2-2)', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ stockQuantity: 10, attributes: { sizeStock: { S: 5, M: 5 } } }),
    ]);
    tx.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'TXL-1' });

    await service.create('u1', {
      items: [
        { productId: 'p1', quantity: 1, selectedAttributes: { size: 'S' } },
        { productId: 'p1', quantity: 1, selectedAttributes: { size: 'M' } },
      ],
      shippingAddress: { line1: '1 Galle Rd' },
    } as any);

    expect(inventory.reserveSize).toHaveBeenCalledTimes(2);
  });

  it('refuses a new order once the account holds too many unpaid ones (QA P0-2)', async () => {
    process.env.MAX_OPEN_PENDING_ORDERS_PER_USER = '3';
    try {
      prisma.order.count.mockResolvedValue(3);
      await expect(service.create('u1', dto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'TOO_MANY_PENDING_ORDERS' }),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      delete process.env.MAX_OPEN_PENDING_ORDERS_PER_USER;
    }
  });

  /**
   * QA P0-1 / P1-8. The old tests here asserted the vulnerable contract —
   * "provisionOrFindGuestUser" found an EXISTING account and returned a
   * session for it. These assert the fixed one.
   */
  describe('guestCheckout', () => {
    let authService: {
      createGuestUser: jest.Mock;
      issueGuestSession: jest.Mock;
    };
    let contactVerification: { verifyCode: jest.Mock };
    let guestService: OrdersService;

    const address = {
      fullName: 'Jane Doe',
      addressLine1: '456 Sea Road',
      city: 'Galle',
      state: 'Southern',
      postalCode: '80000',
      country: 'Sri Lanka',
      phone: '0771234567',
    };
    const guestDto = (over: Record<string, unknown> = {}) =>
      ({
        items: [{ productId: 'p1', quantity: 1 }],
        shippingAddress: address,
        email: 'Guest@Example.com',
        phone: '0771234567',
        fullName: 'Jane Doe',
        paymentMethod: PaymentMethod.PAYHERE,
        ...over,
      }) as any;

    beforeEach(() => {
      authService = {
        createGuestUser: jest.fn().mockResolvedValue({
          id: 'u_guest',
          email: 'guest@example.com',
          role: 'CUSTOMER',
          firstName: 'Jane',
          lastName: 'Doe',
          emailVerified: false,
          phoneVerified: false,
        }),
        issueGuestSession: jest
          .fn()
          .mockResolvedValue({ accessToken: 'token_123', refreshToken: 'r' }),
      };
      contactVerification = { verifyCode: jest.fn().mockResolvedValue(undefined) };
      guestService = new OrdersService(
        prisma as any,
        inventory as any,
        production as any,
        { sendOrderConfirmation: jest.fn() } as any,
        authService as any,
        contactVerification as any,
      );
      prisma.product.findMany.mockResolvedValue([makeProduct()]);
      tx.order.create.mockResolvedValue({ id: 'o_guest', orderNumber: 'TXL-GUEST' });
    });

    it('refuses a contact that already has an account — no session, no order (P0-1)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-id' });

      await expect(guestService.guestCheckout(guestDto())).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LOGIN_REQUIRED' }),
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ email: 'guest@example.com' }, { phone: '+94771234567' }] },
        }),
      );
      expect(authService.createGuestUser).not.toHaveBeenCalled();
      expect(authService.issueGuestSession).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a NEW unverified customer and gives only that account a session', async () => {
      const result = await guestService.guestCheckout(guestDto(), {
        userAgent: 'jest',
        ip: '203.0.113.9',
      });

      expect(authService.createGuestUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          phone: '+94771234567',
          emailVerified: false,
          phoneVerified: false,
        }),
      );
      expect(authService.issueGuestSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u_guest' }),
        'jest',
      );
      expect(result.session).toEqual({ accessToken: 'token_123', refreshToken: 'r' });
      expect(result.order).toMatchObject({ id: 'o_guest' });
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientIp: '203.0.113.9' }),
        }),
      );
    });

    it('refuses COD without a code BEFORE creating any account (P1-8)', async () => {
      await expect(
        guestService.guestCheckout(guestDto({ paymentMethod: PaymentMethod.COD })),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'VERIFICATION_REQUIRED' }),
      });
      expect(authService.createGuestUser).not.toHaveBeenCalled();
    });

    it('verifies the contact code, creates a VERIFIED account and confirms the COD order (P1-8)', async () => {
      const confirm = jest
        .spyOn(guestService, 'confirmOrder')
        .mockResolvedValue(undefined);

      await guestService.guestCheckout(
        guestDto({ paymentMethod: PaymentMethod.COD, verificationCode: '849201' }),
      );

      expect(contactVerification.verifyCode).toHaveBeenCalledWith(
        'guest@example.com',
        'EMAIL',
        '849201',
      );
      expect(authService.createGuestUser).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true, phoneVerified: false }),
      );
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ method: 'COD', currency: 'LKR' }),
        }),
      );
      expect(confirm).toHaveBeenCalledWith('o_guest');
    });

    it('a wrong code creates nothing', async () => {
      contactVerification.verifyCode.mockRejectedValue(
        new BadRequestException({ code: 'OTP_INVALID' }),
      );
      await expect(
        guestService.guestCheckout(
          guestDto({ paymentMethod: PaymentMethod.COD, verificationCode: '000000' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(authService.createGuestUser).not.toHaveBeenCalled();
    });

    it('removes the just-created account when the order itself fails', async () => {
      prisma.product.findMany.mockResolvedValue([makeProduct({ stockQuantity: 0 })]);

      await expect(guestService.guestCheckout(guestDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u_guest' } });
      expect(authService.issueGuestSession).not.toHaveBeenCalled();
    });

    it('a signed-in caller orders as themselves and gets no new session', async () => {
      const result = await guestService.guestCheckout(guestDto(), {
        authenticatedUserId: 'u_signed_in',
      });
      expect(result.session).toBeNull();
      expect(authService.createGuestUser).not.toHaveBeenCalled();
      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u_signed_in' }),
        }),
      );
    });

    it('caps unpaid guest orders per IP address (P0-2)', async () => {
      process.env.MAX_OPEN_GUEST_ORDERS_PER_IP = '3';
      try {
        prisma.order.count.mockResolvedValue(3);
        await expect(
          guestService.guestCheckout(guestDto(), { ip: '203.0.113.9' }),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'TOO_MANY_PENDING_ORDERS' }),
        });
        expect(authService.createGuestUser).not.toHaveBeenCalled();
      } finally {
        delete process.env.MAX_OPEN_GUEST_ORDERS_PER_IP;
      }
    });
  });
});
