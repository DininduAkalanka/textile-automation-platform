import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionService } from '../production/production.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { validateMeasurements } from './measurements.config';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private production: ProductionService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXL-${timestamp}-${random}`;
  }

  async create(userId: string, dto: CreateOrderDto) {
    // Validate all products exist and have sufficient stock
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }

    // Check stock availability
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`,
        );
      }
    }

    // BR3 — custom orders require measurement data (doc 01 §7).
    //
    // Validated against the PRODUCT row, never against anything the client
    // asserts, so a tampered request cannot dodge the rule by mislabelling a
    // uniform as ready-made. Every failing line is reported at once rather than
    // one per round trip.
    const measurementErrors = dto.items.flatMap((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return validateMeasurements(
        product.name,
        product.productType,
        product.requiresMeasurement,
        item.measurements ?? null,
      );
    });

    if (measurementErrors.length > 0) {
      throw new BadRequestException(measurementErrors);
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const orderItems = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const totalPrice = product.price.mul(item.quantity);
      subtotal = subtotal.add(totalPrice);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        // Snapshotted onto the line, so a later edit to the customer's saved
        // measurements never rewrites what was actually cut and stitched.
        measurements: (item.measurements ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      };
    });

    const tax = subtotal.mul(0.0); // Configure tax rate as needed
    const shippingCost = new Prisma.Decimal(0); // Free shipping for now
    const total = subtotal.add(tax).add(shippingCost);

    // Create order with items in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          subtotal,
          tax,
          shippingCost,
          total,
          shippingAddress: dto.shippingAddress as any,
          billingAddress: (dto.billingAddress || dto.shippingAddress) as any,
          notes: dto.notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // Reserve stock on the inventory ledger (D3). reserve() is race-safe (a
      // guarded UPDATE) and writes a RESERVE movement; the earlier JS check is
      // just a fast, friendly pre-validation. Stock is not deducted until the
      // order is confirmed (SALE) — until then it is only reserved.
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId);
        await this.inventory.reserve(
          tx,
          item.productId,
          item.quantity,
          newOrder.id,
          product?.name,
        );
      }

      // Opening transition (null -> PENDING) for the tracking timeline (D4).
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
        },
      });

      return newOrder;
    });

    return order;
  }

  async findUserOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: { product: true },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: {
          include: { product: true },
        },
        payment: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus, changedBy?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transitions
    // Canonical order machine (docs 02/03 §3.3, plan §4.1). Retail-only orders
    // can jump CONFIRMED -> COMPLETED; production orders traverse IN_PRODUCTION
    // -> QUALITY_CHECK -> COMPLETED (driven by the production module). Cancellation
    // is allowed only before production starts (PENDING or CONFIRMED).
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [
        OrderStatus.IN_PRODUCTION,
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
      ],
      IN_PRODUCTION: [OrderStatus.QUALITY_CHECK],
      QUALITY_CHECK: [OrderStatus.COMPLETED],
      COMPLETED: [OrderStatus.DELIVERED],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    // Confirmation deducts stock (SALE) through the shared, idempotent path.
    if (status === OrderStatus.CONFIRMED) {
      await this.confirmOrder(id, changedBy);
      return this.findById(id);
    }

    await this.prisma.$transaction(async (tx) => {
      if (status === OrderStatus.CANCELLED) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: id },
        });
        for (const item of orderItems) {
          if (order.status === OrderStatus.PENDING) {
            // Not yet sold — free the reservation.
            await this.inventory.release(tx, item.productId, item.quantity, id);
          } else {
            // Already sold (CONFIRMED) — return units to available.
            await this.inventory.restock(tx, item.productId, item.quantity, id);
          }
        }
      }

      await tx.order.update({ where: { id }, data: { status } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status,
          changedBy: changedBy ?? null,
        },
      });
    });

    return this.findById(id);
  }

  /**
   * Confirm an order (PENDING -> CONFIRMED) and deduct its reserved stock as a
   * SALE. Idempotent and concurrency-safe: the order row is locked FOR UPDATE
   * and a non-PENDING order is a no-op, so a duplicate confirmation (e.g. a mock
   * confirm racing a webhook) can never double-deduct. Called by payments + admin.
   */
  async confirmOrder(orderId: string, changedBy?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: OrderStatus }>>`
        SELECT status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;

      if (locked.length === 0) {
        throw new NotFoundException('Order not found');
      }
      if (locked[0].status !== OrderStatus.PENDING) {
        return; // already confirmed/cancelled — idempotent no-op
      }

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await this.inventory.sale(tx, item.productId, item.quantity, orderId);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
          changedBy: changedBy ?? null,
        },
      });

      // ProductionTrigger (decision D8, FR-P1). Fires here rather than in the
      // payment module so that ALL three confirmation paths — PayHere webhook,
      // COD placement and admin bank-slip verification — create tasks through
      // one pipeline. Inside the same transaction as the SALE deduction, so a
      // confirmed order and its production tasks exist together or not at all.
      //
      // The early return above already makes this run once per order; the
      // trigger is independently idempotent as well, because the cost of a
      // duplicate task set (a garment cut twice) is far higher than the cost of
      // the extra COUNT.
      await this.production.createTasksForOrder(tx, orderId);
    });
  }

  async findAllOrders(page = 1, limit = 20, status?: OrderStatus) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: { include: { product: true } },
          payment: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
