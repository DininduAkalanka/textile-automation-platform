import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, PaymentMethod, ProductType, UserRole } from '@prisma/client';

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
  let customId: string;
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
    (await prisma.inventory.findUniqueOrThrow({ where: { productId } }))
      .quantityReserved;

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
        emailVerified: true,
        firstName: 'BR3',
        lastName: 'Tester',
        role: UserRole.CUSTOMER,
      },
    });
    userId = user.id;

    uniformId = await seedProduct('uniform', ProductType.UNIFORM, true);
    customId = await seedProduct('custom', ProductType.CUSTOM, true);
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

  /**
   * [QA-2.3a] Order a CUSTOM/UNIFORM product with an empty measurements object
   * asserts 400 BadRequestException, not silent acceptance.
   */
  it('[QA-2.3a] refuses CUSTOM/UNIFORM products ordered with empty measurements', async () => {
    // 1. Uniform with completely empty object
    await expect(
      orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {} as any,
          },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);

    // 2. Uniform with personName but empty values
    await expect(
      orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: { personName: 'Nimal', values: {} } as any,
          },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);

    // 3. Custom product with empty measurements
    await expect(
      orders.create(userId, {
        items: [
          {
            productId: customId,
            quantity: 1,
            measurements: {} as any,
          },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * [QA-2.3b] One required field missing for specific garment type rejects
   * with a field-specific error message.
   */
  it('[QA-2.3b] rejects with a field-specific error when a required measurement is omitted', async () => {
    // Custom garment requires SHIRT fields (chest, waist, shoulder, sleeveLength, shirtLength)
    // Omit 'chest'
    try {
      await orders.create(userId, {
        items: [
          {
            productId: customId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: {
                waist: 66,
                shoulder: 36,
                sleeveLength: 46,
                shirtLength: 60,
              },
            },
          },
        ],
        shippingAddress: address,
      });
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as any;
      const message = JSON.stringify(res);
      expect(message).toMatch(/Chest is required/i);
    }

    // Uniform requires SHIRT + TROUSER fields. Omit 'trouserLength'
    const { trouserLength: _omitted, ...missingTrouserLengthValues } =
      measurements.values;
    try {
      await orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: missingTrouserLengthValues,
            },
          },
        ],
        shippingAddress: address,
      });
      fail('Expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as any;
      const message = JSON.stringify(res);
      expect(message).toMatch(/Trouser length is required/i);
    }
  });

  /**
   * [QA-2.3c] A measurement value outside sane physical range (negative, zero,
   * or absurdly large) rejects with field-specific bounds.
   */
  it('[QA-2.3c] rejects out-of-range measurement values (negative, zero, or absurdly large)', async () => {
    // 1. Negative measurement
    try {
      await orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: { ...measurements.values, chest: -10 },
            },
          },
        ],
        shippingAddress: address,
      });
      fail('Expected BadRequestException for negative chest');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as any;
      expect(JSON.stringify(res)).toMatch(/Chest must be between 20 and 200 cm/i);
    }

    // 2. Zero measurement
    try {
      await orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: { ...measurements.values, waist: 0 },
            },
          },
        ],
        shippingAddress: address,
      });
      fail('Expected BadRequestException for zero waist');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as any;
      expect(JSON.stringify(res)).toMatch(/Waist must be between 20 and 200 cm/i);
    }

    // 3. Absurdly large measurement
    try {
      await orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: {
              personName: 'Nimal',
              values: { ...measurements.values, sleeveLength: 5000 },
            },
          },
        ],
        shippingAddress: address,
      });
      fail('Expected BadRequestException for absurd sleeve length');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as any;
      expect(JSON.stringify(res)).toMatch(
        /Sleeve length must be between 10 and 100 cm/i,
      );
    }
  });

  /**
   * [QA-2.3d] Enumerate all order-creation entry points in the codebase and
   * confirm measurement validation runs on each:
   * Entry Point 1: POST /orders (authenticated customer checkout via OrdersService.create)
   * Entry Point 2: POST /orders/guest-checkout (guest checkout via OrdersService.guestCheckout)
   * Note: No admin-create-order endpoint exists in this codebase (confirmed by inspecting OrdersController).
   */
  it('[QA-2.3d] measurement validation runs across all order entry points (standard AND guest)', async () => {
    // 1. Standard checkout: invalid measurement is rejected
    await expect(
      orders.create(userId, {
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: { personName: 'Nimal', values: {} } as any,
          },
        ],
        shippingAddress: address,
      }),
    ).rejects.toThrow(BadRequestException);

    // 2. Guest checkout: invalid measurement is rejected with same validation
    await expect(
      orders.guestCheckout({
        items: [
          {
            productId: uniformId,
            quantity: 1,
            measurements: { personName: 'Nimal', values: {} } as any,
          },
        ],
        shippingAddress: address,
        email: `${TAG}-guest-entry@example.test`,
        phone: '+94770001122',
        fullName: 'Guest Entry Test',
        paymentMethod: PaymentMethod.STRIPE,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
