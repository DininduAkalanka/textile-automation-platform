'use client';

import Link from 'next/link';
import { AlertTriangle, Banknote, Clock, Package, ShoppingCart } from 'lucide-react';

import { RevenueChart } from '@/components/admin/revenue-chart';
import { StatCard } from '@/components/admin/stat-card';
import { TopProducts } from '@/components/admin/top-products';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Status colours.
 *
 * Only CANCELLED gets crimson. If every status were a different bright colour the
 * table would read as a paint chart and none of them would mean anything — the
 * point of colour here is that CANCELLED should catch the eye and CONFIRMED should
 * not.
 */
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-[#F4F3EF] text-[#6E6A5E]',
  CONFIRMED: 'bg-[#EFF4FA] text-[#3A5F87]',
  IN_PRODUCTION: 'bg-[#FBF3E4] text-[#8F711D]',
  QUALITY_CHECK: 'bg-[#F3F0FA] text-[#5B4B8A]',
  COMPLETED: 'bg-[#EDF7F1] text-[#2F6B49]',
  DELIVERED: 'bg-[#EDF7F1] text-[#2F6B49]',
  CANCELLED: 'bg-[#FFF0F0] text-[#A80000]',
};

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  const totals = data?.totals;
  const deltas = data?.deltas;

  if (isError) {
    return (
      <div className="rounded-2xl border border-[#CC0000]/25 bg-white p-10 text-center">
        <p className="mb-4 text-sm text-[#4A4740]">Could not load the dashboard.</p>
        <button
          onClick={() => void refetch()}
          className="rounded-lg bg-[#CC0000] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A80000]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-[#0F0F0F]">
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-[#928E82]">
          Trading summary for the last 30 days
        </p>
      </div>

      {/* Revenue is the only obsidian card. It is the number the owner opened this
          page for; everything else is context for it. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          hero
          label="Revenue"
          value={totals ? formatLKR(totals.revenue) : '—'}
          icon={Banknote}
          changePercent={deltas?.revenueChangePercent}
          changeLabel="vs previous 30 days"
          loading={isLoading}
        />
        <StatCard
          label="Paid orders"
          value={totals?.totalOrders ?? '—'}
          icon={ShoppingCart}
          changePercent={deltas?.paidOrdersChangePercent}
          changeLabel="vs previous 30 days"
          loading={isLoading}
        />
        <StatCard
          label="Awaiting payment"
          value={totals?.pendingOrders ?? '—'}
          icon={Clock}
          hint={
            totals?.pendingOrders
              ? 'Holding reserved stock'
              : 'Nothing outstanding'
          }
          loading={isLoading}
        />
        <StatCard
          label="Low stock"
          value={totals?.lowStockCount ?? '—'}
          icon={totals?.lowStockCount ? AlertTriangle : Package}
          hint={
            totals?.lowStockCount
              ? 'At or below minimum level'
              : 'All products above minimum'
          }
          alert={Boolean(totals?.lowStockCount)}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="h-[300px] animate-pulse rounded-2xl bg-white" />
          ) : (
            <RevenueChart points={data!.salesByDay} />
          )}
        </div>

        <div>
          {isLoading ? (
            <div className="h-[300px] animate-pulse rounded-2xl bg-white" />
          ) : (
            <TopProducts products={data!.topProducts} />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        <div className="flex items-center justify-between border-b border-[#F4F3EF] px-6 py-4">
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-[#0F0F0F]">
              Recent orders
            </h2>
            <p className="mt-0.5 text-[11px] text-[#928E82]">Latest 8</p>
          </div>
          <Link
            href="/admin/production"
            className="text-[11px] font-semibold text-[#CC0000] transition-opacity hover:opacity-70"
          >
            Production board →
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-[#FAFAF8]" />
            ))}
          </div>
        ) : data!.recentOrders.length === 0 ? (
          <p className="py-14 text-center text-sm text-[#928E82]">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F4F3EF]">
                  {['Order', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4A8]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data!.recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[#F4F3EF] transition-colors last:border-0 hover:bg-[#FAFAF8]"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-[11px] text-[#928E82]">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[13px] text-[#4A4740]">
                      {order.customerName}
                    </td>
                    <td className="px-6 py-3.5 font-display text-[13px] font-bold tabular-nums text-[#0F0F0F]">
                      {formatLKR(order.total)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          STATUS_STYLE[order.status] ?? 'bg-[#F4F3EF] text-[#6E6A5E]',
                        )}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          order.paymentStatus === 'COMPLETED'
                            ? 'text-[#2F6B49]'
                            : order.paymentStatus === 'FAILED'
                              ? 'text-[#CC0000]'
                              : 'text-[#B8B4A8]',
                        )}
                      >
                        {order.paymentStatus ?? 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[11px] tabular-nums text-[#B8B4A8]">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
