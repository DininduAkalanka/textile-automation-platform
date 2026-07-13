import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, ProductType, UserRole } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * BR3 end-to-end: a measured product cannot be ordered without measurements, and
 * the measurements that are supplied are snapshotted onto the order item so the
 * production floor can read them (plan Session 3.1, decision D8).
 *
 * The unit tests in measurements.config.spec.ts cover the validation rules. This
 * covers the thing that actually matters to the business: the order is refused,
 * and — critically — no stock is reserved when it is.
 */
describe('BR3 measurements at checkout', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;

  const TAG = `br3-${Date.now()}`;
  let userId: string;
  let uniformId: string;
  let readyMadeId: string;

  const address = {
    fullName: 'Nimal Perera',
    addressLine1: '12 Galle Road',
    city: 'Colombo',
    state: 'Western',
    postalCode: '00300',
    country: 'LK',
  };

  const measurements = {
    personName: 'Nimal Perera',
    label: 'Son — Grade 5',
    values: {
      chest: 76,
      waist: 66,
      shoulder: 36,
      sleeveLength: 46,
      shirtLength: 60,
      trouserWaist: 66,
      hip: 80,
      trouserLength: 90,
    },
  };

  async function seedProduct(
    label: string,
    productType: ProductType,
    requiresMeasurement: boolean,
  ) {
    const product = await prisma.product.create({
      data: {
        name: `BR3 ${label}`,
        slug: `${TAG}-${label}`,
        sku: `${TAG}-${label}`,
        price: 2500,
        stockQuantity: 10,
        productType,
        requiresMeasurement,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        quantityAvailable: 10,
        quantityReserved: 0,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: MovementType.INITIAL,
        quantityChange: 10,
      },
    });

    return product.id;
  }

  const reservedFor = async (productId: string) =>
    (
      await prisma.inventory.findUniqueOrThrow({ where: { productId } })
    ).quantityReserved;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);

    const user = await prisma.user.create({
      data: {
        email: `${TAG}@example.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'BR3',
        lastName: 'Tester',
        role: UserRole.CUSTOMER,
      },
    });
    userId = user.id;

    uniformId = await seedProduct('uniform', ProductType.UNIFORM, true);
    readyMadeId = await seedProduct('readymade', ProductType.READY_MADE, false);
  });

  afterAll(async () => {
    // Movements before orders: the FK is ON DELETE RESTRICT so an order's stock
    // history cannot be silently erased with it (see the 20260712100000 migration).
    await prisma.inventoryMovement.deleteMany({
      where: { inventory: { product: { sku: { startsWith: TAG } } } },
    });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('refuses a uniform ordered without measurements', async () => {
    await expect(
      orders.create(userId, {
        items: [{ productId: uniformId, quantity: 1 }],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reserves NO stock when it refuses — a rejected order must not hold inventory', async () => {
    const before = await reservedFor(uniformId);

    await expect(
      orders.create(userId, {
        items: [{ productId: uniformId, quantity: 2 }],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);

    // BR3 is checked before the transaction opens, so nothing was reserved and
    // there is nothing to roll back. A regression here would silently strand
    // stock on every rejected checkout.
    expect(await reservedFor(uniformId)).toBe(before);
  });

  it('accepts a uniform WITH measurements and snapshots them onto the line', async () => {
    const order = await orders.create(userId, {
      items: [{ productId: uniformId, quantity: 1, measurements }],
      shippingAddress: address,
    });

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id, productId: uniformId },
    });

    // The production floor reads this JSON; it must survive the round trip.
    expect(item.measurements).toMatchObject({
      personName: 'Nimal Perera',
      values: { chest: 76, trouserLength: 90 },
    });
  });

  it('accepts a ready-made item with no measurements', async () => {
    const order = await orders.create(userId, {
      items: [{ productId: readyMadeId, quantity: 1 }],
      shippingAddress: address,
    });

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id, productId: readyMadeId },
    });

    expect(item.measurements).toBeNull();
  });

  it('refuses a MIXED order when only the uniform lacks measurements', async () => {
    // The retail line is fine; the whole order must still fail, and the retail
    // line must not be reserved on its own.
    const beforeRetail = await reservedFor(readyMadeId);

    await expect(
      orders.create(userId, {
        items: [
          { productId: readyMadeId, quantity: 1 },
          { productId: uniformId, quantity: 1 },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(await reservedFor(readyMadeId)).toBe(beforeRetail);
  });

  it('cannot be bypassed by sending a half-filled measurement set', async () => {
    await expect(
      orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: { chest: 76 }, // 7 fields missing
            },
          },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
