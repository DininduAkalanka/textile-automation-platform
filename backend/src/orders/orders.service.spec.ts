import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

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
    product: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let inventory: { reserve: jest.Mock; sale: jest.Mock; release: jest.Mock; restock: jest.Mock };
  let tx: {
    order: { create: jest.Mock };
    orderStatusHistory: { create: jest.Mock };
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
    };
    inventory = {
      reserve: jest.fn(),
      sale: jest.fn(),
      release: jest.fn(),
      restock: jest.fn(),
    };
    prisma = {
      product: { findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventory },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('reserves stock and records the opening PENDING transition on success', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    tx.order.create.mockResolvedValue({ id: 'o1', orderNumber: 'TXL-1' });

    const result = await service.create('u1', dto);

    expect(result).toEqual({ id: 'o1', orderNumber: 'TXL-1' });
    expect(inventory.reserve).toHaveBeenCalledWith(tx, 'p1', 2, 'o1', 'Cotton Shirt');
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'o1', fromStatus: null, toStatus: 'PENDING' }),
      }),
    );
  });

  it('rejects before opening a transaction when sellable stock is short (fast pre-check)', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ stockQuantity: 1 })]);

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(inventory.reserve).not.toHaveBeenCalled();
  });

  it('propagates the reservation failure when the guarded UPDATE matches 0 rows (race lost)', async () => {
    // Passes the JS pre-check (looks like 5) but a concurrent order took the
    // stock first, so reserve() throws — the whole order creation must abort.
    prisma.product.findMany.mockResolvedValue([makeProduct({ stockQuantity: 5 })]);
    tx.order.create.mockResolvedValue({ id: 'o1' });
    inventory.reserve.mockRejectedValue(new BadRequestException('Insufficient stock'));

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
