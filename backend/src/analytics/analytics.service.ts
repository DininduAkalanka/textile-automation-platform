import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin analytics (plan Session 8.1).
 *
 * Three rules govern every query in this file.
 *
 * 1. Revenue counts ONLY money actually received: `payments.status = COMPLETED`.
 *    Counting order totals would inflate revenue with pending, unpaid and
 *    cancelled orders.
 * 2. Aggregation happens in SQL, never in a JS loop. The previous dashboard
 *    summed `orders.reduce(...)` over the first page of ten orders, so the
 *    revenue figure was wrong the moment an eleventh order existed.
 * 3. Money is returned as a decimal STRING, never a JS number. `Number()` on a
 *    money value is float arithmetic, which CODING_STANDARDS forbids.
 *
 * Counts are cast `::int` because Postgres `COUNT(*)` returns bigint, which
 * becomes a JS BigInt and throws on `JSON.stringify`.
 *
 * Every method below is a pure function of (params) -> typed result. Phase 9
 * wraps these directly as whitelisted AI tools (decision D9), so keep them free
 * of request/response concerns.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DashboardTotals {
  /** Decimal string. Sum of COMPLETED payments inside the range. */
  revenue: string;
  ordersToday: number;
  pendingOrders: number;
  lowStockCount: number;
  totalOrders: number;
  totalProducts: number;
}

/**
 * The same metric over the PREVIOUS window of equal length.
 *
 * A revenue figure on its own is a number, not an insight — "Rs 21,900" tells an
 * owner nothing until they know whether that is up or down. This is what turns a
 * stat tile into information (plan Session 8.1: "StatCards w/ delta vs previous
 * period").
 */
export interface DashboardDeltas {
  /** Decimal string — revenue in the immediately preceding window. */
  previousRevenue: string;
  /** Percent change, or null when the previous window had no revenue (division
   * by zero is not "infinite growth", it is "no basis for comparison"). */
  revenueChangePercent: number | null;
  previousPaidOrders: number;
  paidOrdersChangePercent: number | null;
}

export interface SalesByDayPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Decimal string */
  revenue: string;
  /** Number of paid orders that day */
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  /** Decimal string */
  revenue: string;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  /** Decimal string */
  total: string;
  status: string;
  paymentStatus: string | null;
  createdAt: Date;
}

export interface DashboardPayload {
  range: { from: string; to: string };
  totals: DashboardTotals;
  deltas: DashboardDeltas;
  salesByDay: SalesByDayPoint[];
  topProducts: TopProduct[];
  ordersByStatus: OrderStatusCount[];
  recentOrders: RecentOrder[];
}

const DEFAULT_WINDOW_DAYS = 30;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** Defaults to the trailing 30 days when the caller supplies no range. */
  resolveRange(from?: string, to?: string): DateRange {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return { from: start, to: end };
  }

  /**
   * The window immediately before this one, of exactly the same length.
   *
   * "Same length" matters: comparing a 30-day month against a 31-day one would
   * manufacture a 3% swing out of the calendar.
   */
  private previousRange({ from, to }: DateRange): DateRange {
    const span = to.getTime() - from.getTime();
    return { from: new Date(from.getTime() - span), to: new Date(from) };
  }

  async getDeltas(range: DateRange): Promise<DashboardDeltas> {
    const previous = this.previousRange(range);

    const [current, prior] = await Promise.all([
      this.paidTotals(range),
      this.paidTotals(previous),
    ]);

    return {
      previousRevenue: prior.revenue,
      revenueChangePercent: percentChange(
        Number(current.revenue),
        Number(prior.revenue),
      ),
      previousPaidOrders: prior.paidOrders,
      paidOrdersChangePercent: percentChange(
        current.paidOrders,
        prior.paidOrders,
      ),
    };
  }

  /** Revenue + paid-order count for one window. Shared by totals and deltas. */
  private async paidTotals({ from, to }: DateRange) {
    const rows = await this.prisma.$queryRaw<
      Array<{ revenue: string; paidOrders: number }>
    >`
      SELECT COALESCE(SUM(amount), 0)::text            AS "revenue",
             COUNT(DISTINCT order_id)::int             AS "paidOrders"
        FROM payments
       WHERE status = 'COMPLETED'
         AND COALESCE(paid_at, created_at) BETWEEN ${from} AND ${to}
    `;
    return rows[0];
  }

  async getTotals({ from, to }: DateRange): Promise<DashboardTotals> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        revenue: string;
        ordersToday: number;
        pendingOrders: number;
        lowStockCount: number;
        totalOrders: number;
        totalProducts: number;
      }>
    >`
      SELECT
        (SELECT COALESCE(SUM(amount), 0)
           FROM payments
          WHERE status = 'COMPLETED'
            AND COALESCE(paid_at, created_at) BETWEEN ${from} AND ${to})::text
          AS "revenue",
        (SELECT COUNT(*) FROM orders
          WHERE created_at >= date_trunc('day', now()))::int AS "ordersToday",
        (SELECT COUNT(*) FROM orders WHERE status = 'PENDING')::int
          AS "pendingOrders",
        (SELECT COUNT(*) FROM inventory
          WHERE quantity_available <= minimum_stock_level)::int
          AS "lowStockCount",
        (SELECT COUNT(*) FROM orders)::int AS "totalOrders",
        (SELECT COUNT(*) FROM products WHERE is_active)::int AS "totalProducts"
    `;

    return rows[0];
  }

  /**
   * Zero-filled: a day with no sales returns 0.00 rather than being absent, so
   * a chart cannot silently compress an empty week.
   */
  async getSalesByDay({ from, to }: DateRange): Promise<SalesByDayPoint[]> {
    return this.prisma.$queryRaw<SalesByDayPoint[]>`
      WITH days AS (
        SELECT generate_series(${from}::date, ${to}::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD')          AS "date",
             COALESCE(SUM(p.amount), 0)::text      AS "revenue",
             COUNT(p.id)::int                      AS "orders"
        FROM days d
        LEFT JOIN payments p
               ON p.status = 'COMPLETED'
              AND date(COALESCE(p.paid_at, p.created_at)) = d.day
       GROUP BY d.day
       ORDER BY d.day
    `;
  }

  async getTopProducts(
    { from, to }: DateRange,
    limit = 5,
  ): Promise<TopProduct[]> {
    return this.prisma.$queryRaw<TopProduct[]>`
      SELECT pr.id                        AS "productId",
             pr.name                      AS "name",
             SUM(oi.quantity)::int        AS "quantity",
             SUM(oi.total_price)::text    AS "revenue"
        FROM order_items oi
        JOIN orders o    ON o.id = oi.order_id
        JOIN payments p  ON p.order_id = o.id AND p.status = 'COMPLETED'
        JOIN products pr ON pr.id = oi.product_id
       WHERE COALESCE(p.paid_at, p.created_at) BETWEEN ${from} AND ${to}
       GROUP BY pr.id, pr.name
       ORDER BY SUM(oi.total_price) DESC
       LIMIT ${limit}
    `;
  }

  async getOrdersByStatus(): Promise<OrderStatusCount[]> {
    return this.prisma.$queryRaw<OrderStatusCount[]>`
      SELECT status::text AS "status", COUNT(*)::int AS "count"
        FROM orders
       GROUP BY status
       ORDER BY COUNT(*) DESC
    `;
  }

  async getRecentOrders(limit = 8): Promise<RecentOrder[]> {
    const orders = await this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        payment: { select: { status: true } },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${order.user.firstName} ${order.user.lastName}`.trim(),
      // Prisma Decimal -> string. Never Number().
      total: order.total.toFixed(2),
      status: order.status,
      paymentStatus: order.payment?.status ?? null,
      createdAt: order.createdAt,
    }));
  }

  // ─── CSV reports (plan Session 8.1 task 2) ───────────────────────────────
  // Downloads for the /admin/reports section. Money stays a decimal string;
  // every export is audited. Reuses the same COMPLETED-payments rule as above.

  async salesReport({
    from,
    to,
  }: DateRange): Promise<
    { name: string; type: string; quantity: number; revenue: string }[]
  > {
    return this.prisma.$queryRaw`
      SELECT pr.name                    AS "name",
             pr.product_type::text      AS "type",
             SUM(oi.quantity)::int      AS "quantity",
             SUM(oi.total_price)::text  AS "revenue"
        FROM order_items oi
        JOIN orders o    ON o.id = oi.order_id
        JOIN payments p  ON p.order_id = o.id AND p.status = 'COMPLETED'
        JOIN products pr ON pr.id = oi.product_id
       WHERE COALESCE(p.paid_at, p.created_at) BETWEEN ${from} AND ${to}
       GROUP BY pr.name, pr.product_type
       ORDER BY SUM(oi.total_price) DESC
    `;
  }

  async inventoryReport(): Promise<
    {
      name: string;
      type: string;
      available: number;
      reserved: number;
      sellable: number;
      minimum: number;
      low: boolean;
    }[]
  > {
    return this.prisma.$queryRaw`
      SELECT pr.name                                       AS "name",
             pr.product_type::text                         AS "type",
             i.quantity_available::int                     AS "available",
             i.quantity_reserved::int                      AS "reserved",
             (i.quantity_available - i.quantity_reserved)::int AS "sellable",
             i.minimum_stock_level::int                    AS "minimum",
             (i.quantity_available <= i.minimum_stock_level) AS "low"
        FROM products pr
        JOIN inventory i ON i.product_id = pr.id
       ORDER BY pr.name
    `;
  }

  /** RFC-4180 CSV: quote any field containing a comma, quote or newline. */
  toCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
    const cell = (v: string | number | boolean | null): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }

  async recordExport(
    userId: string,
    kind: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'report.export',
        entityType: 'report',
        entityId: kind,
        after: meta as object,
      },
    });
  }

  async getDashboard(from?: string, to?: string): Promise<DashboardPayload> {
    const range = this.resolveRange(from, to);

    const [
      totals,
      deltas,
      salesByDay,
      topProducts,
      ordersByStatus,
      recentOrders,
    ] = await Promise.all([
      this.getTotals(range),
      this.getDeltas(range),
      this.getSalesByDay(range),
      this.getTopProducts(range),
      this.getOrdersByStatus(),
      this.getRecentOrders(),
    ]);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      totals,
      deltas,
      salesByDay,
      topProducts,
      ordersByStatus,
      recentOrders,
    };
  }
}

/**
 * Percent change, or null when there is nothing to compare against.
 *
 * Returning null rather than 100 (or Infinity) for a zero baseline is deliberate:
 * going from Rs 0 to Rs 21,900 is not "+100% growth", it is a first sale. The UI
 * shows "no prior data" instead of a triumphant and meaningless number.
 */
function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
