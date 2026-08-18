import { NotFoundException } from '@nestjs/common';

import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Focused tests for the "Customers also bought" market-basket recommender: the
 * co-occurrence ranking is preserved through the id→product hydration, and the
 * cold-start fallback tops the strip up with same-category products.
 */
describe('ProductsService.frequentlyBoughtTogether', () => {
  const makePrisma = (over: Partial<Record<string, any>> = {}) =>
    ({
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      ...over,
    }) as unknown as PrismaService;

  it('preserves the co-occurrence order after hydrating products', async () => {
    const prisma = makePrisma();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'x',
      categoryId: 'c1',
    });
    // Ranked by co-purchase count: b (3) then a (1).
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'b', together: 3n },
      { id: 'a', together: 1n },
    ]);
    // findMany returns them in a different (db) order — service must re-sort.
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);

    const service = new ProductsService(prisma);
    const result = await service.frequentlyBoughtTogether('x', 2);

    expect(result.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('falls back to same-category products when there is no purchase signal', async () => {
    const prisma = makePrisma();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'x',
      categoryId: 'c1',
    });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]); // cold start
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      { id: 'f1', name: 'Filler 1' },
      { id: 'f2', name: 'Filler 2' },
    ]);

    const service = new ProductsService(prisma);
    const result = await service.frequentlyBoughtTogether('x', 4);

    expect(result.map((p) => p.id)).toEqual(['f1', 'f2']);
    // Fallback query must scope to the same category and exclude this product.
    const call = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.categoryId).toBe('c1');
    expect(call.where.id.notIn).toContain('x');
  });

  it('throws NotFound for a missing product', async () => {
    const prisma = makePrisma();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

    const service = new ProductsService(prisma);
    await expect(
      service.frequentlyBoughtTogether('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProductsService.relatedProducts', () => {
  const makePrisma = () =>
    ({
      product: { findUnique: jest.fn(), findMany: jest.fn() },
    }) as unknown as PrismaService;

  it('ranks same-category candidates by attribute similarity', async () => {
    const prisma = makePrisma();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'x',
      categoryId: 'c1',
      fabricType: 'Cotton',
      color: 'White',
      productType: 'READY_MADE',
      price: 2000,
    });
    // Pool: 'far' shares nothing; 'near' shares fabric+colour+type+price.
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'far',
        fabricType: 'Silk',
        color: 'Black',
        productType: 'CUSTOM',
        price: 9000,
      },
      {
        id: 'near',
        fabricType: 'Cotton',
        color: 'White',
        productType: 'READY_MADE',
        price: 2100,
      },
    ]);

    const service = new ProductsService(prisma);
    const result = await service.relatedProducts('x', 2);

    expect(result[0].id).toBe('near'); // most similar first
  });

  it('throws NotFound for a missing product', async () => {
    const prisma = makePrisma();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new ProductsService(prisma);
    await expect(service.relatedProducts('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
