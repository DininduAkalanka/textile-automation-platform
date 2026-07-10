import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
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
