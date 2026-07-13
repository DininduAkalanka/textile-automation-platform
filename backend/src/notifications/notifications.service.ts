import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Reads the notification bell (plan Session 7.1, task 4).
 *
 * The WRITE side is deliberately not here. Every producer — the low-stock alert
 * (inventory.service.ts, Phase 5), and now every order status change
 * (order.machine.ts's orderStatusNotification, written from orders.service.ts and
 * production.service.ts) — writes its own row inside its own transaction, because
 * a notification about a state change must commit atomically WITH that change, or
 * not at all. Centralising the write here would mean either this service reaching
 * into other modules' transactions, or the notification arriving a moment after
 * (and possibly never, if the write failed) the thing it describes.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      // Drives the bell's badge count. A SEPARATE count, not items.filter(), so
      // it stays correct even on page 2+ where the current page holds none.
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items,
      unreadCount,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Ownership is enforced in the WHERE clause, not by a separate lookup-then-
   * check — the same guarded-write pattern the inventory ledger uses (see
   * inventory.service.ts). Matching zero rows because the id does not exist and
   * matching zero rows because it belongs to someone else look identical from
   * the caller's side, which is the point: a 404 either way tells an attacker
   * nothing about whether the id exists at all.
   */
  async markRead(id: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
