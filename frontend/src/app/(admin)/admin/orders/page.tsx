'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';

import { useAdminOrders } from '@/hooks/use-orders';
import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { OrderStatus } from '@/types';

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'QUALITY_CHECK', label: 'Quality check' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

type PaymentStatusFilter = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | '';
const PAYMENT_STATUS_OPTIONS: { value: PaymentStatusFilter; label: string }[] = [
  { value: '', label: 'Any payment status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

type MethodFilter = 'STRIPE' | 'PAYHERE' | 'COD' | 'INSTALLMENT' | '';
const METHOD_OPTIONS: { value: MethodFilter; label: string }[] = [
  { value: '', label: 'Any method' },
  { value: 'PAYHERE', label: 'PayHere' },
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'INSTALLMENT', label: 'Installment' },
  { value: 'STRIPE', label: 'Card (Stripe)' },
];

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'bg-[#FDF6E7] text-[#8A6A17] ring-1 ring-inset ring-[#D4AF37]/35',
  CONFIRMED: 'bg-[#F4F3EF] text-[#6E6A5E] ring-1 ring-inset ring-[#EAE8E1]',
  IN_PRODUCTION: 'bg-[#F4F3EF] text-[#6E6A5E] ring-1 ring-inset ring-[#EAE8E1]',
  QUALITY_CHECK: 'bg-[#F4F3EF] text-[#6E6A5E] ring-1 ring-inset ring-[#EAE8E1]',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  CANCELLED: 'bg-[#FFF5F5] text-[#A80000] ring-1 ring-inset ring-[#CC0000]/20',
};

/** Admin order table (plan Session 7.1, task 1). */
export default function AdminOrdersPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('');
  const [method, setMethod] = useState<MethodFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const hasFilters = Boolean(search || status || paymentStatus || method || from || to);

  function clearFilters() {
    setSearch('');
    setStatus('');
    setPaymentStatus('');
    setMethod('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  const { data, isLoading, isError } = useAdminOrders({
    page,
    search: search.trim() || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    method: method || undefined,
    // Inclusive end of day: a bare date "to" the backend receives is midnight,
    // which would silently exclude every order placed later that same day.
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  });

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-2 text-xl font-semibold">Admin access required</h2>
        <Link href="/login" className="text-[#CC0000] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
          Orders
        </h1>
        <p className="mt-0.5 text-[13px] text-[#928E82]">
          {data ? `${data.pagination.total} order${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B8B4A8]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Order number, customer name or email…"
            className="w-full rounded-lg border border-[#EAE8E1] bg-white py-2 pl-9 pr-3 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value as PaymentStatusFilter);
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
        >
          {PAYMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as MethodFilter);
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Placed from"
            className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
          />
          <span className="text-[12px] text-[#B8B4A8]">–</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            aria-label="Placed to"
            className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-[#EAE8E1] bg-white px-2.5 py-2 text-[12px] font-medium text-[#928E82] transition-colors hover:border-[#D5D2C8] hover:text-[#0F0F0F]"
          >
            <X size={12} aria-hidden />
            Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading orders…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-[#CC0000]">Could not load orders.</p>
        ) : !data || data.orders.length === 0 ? (
          <p className="py-20 text-center text-sm text-[#928E82]">
            {hasFilters ? 'No orders match these filters.' : 'No orders yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EAE8E1] bg-[#FAFAF8]">
                  {['Order', 'Customer', 'Placed', 'Items', 'Total', 'Status', 'Payment'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#928E82]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="cursor-pointer border-b border-[#F4F3EF] transition-colors hover:bg-[#FAFAF8]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-[12px] font-medium text-[#0F0F0F] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#4A4740]">
                      {order.user ? `${order.user.firstName} ${order.user.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#928E82]">
                      {new Date(order.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-[#4A4740]">
                      {order.items?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 font-display text-[13px] font-semibold tabular-nums text-[#0F0F0F]">
                      {formatLKR(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                          STATUS_STYLE[order.status],
                        )}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#928E82]">
                      {order.payment ? `${order.payment.method} · ${order.payment.status}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-[#928E82]">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] transition-colors hover:border-[#D5D2C8] disabled:cursor-not-allowed disabled:text-[#D5D2C8]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] transition-colors hover:border-[#D5D2C8] disabled:cursor-not-allowed disabled:text-[#D5D2C8]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
