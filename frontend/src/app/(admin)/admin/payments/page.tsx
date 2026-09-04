'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CreditCard, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { AdminPayment } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';

const statusBadge: Record<string, string> = {
  PENDING: 'bg-[#FDF6E7] text-[#8A6A17] ring-1 ring-inset ring-[#D4AF37]/35',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  FAILED: 'bg-[#FFF0F0] text-[#A80000] ring-1 ring-inset ring-[#CC0000]/25',
  REFUNDED: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
};

const methodIcon: Record<string, string> = {
  PAYHERE: '💳',
  COD: '💵',
  INSTALLMENT: '📅',
  STRIPE: '💳',
};

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Installments', value: 'INSTALLMENT' },
  { label: 'Failed', value: 'FAILED' },
];

export default function AdminPaymentsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const query: { status?: string; method?: string } = {};
    if (activeFilter === 'INSTALLMENT') {
      query.method = 'INSTALLMENT';
    } else if (activeFilter) {
      query.status = activeFilter;
    }

    api
      .getAllPayments(1, 50, Object.keys(query).length > 0 ? query : undefined)
      .then((res) => setPayments(res.payments || []))
      .catch((e: any) => setError(e.message || 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') load();
    else setLoading(false);
  }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-4xl">🔒</p>
        <h2 className="mb-2 font-display text-xl font-semibold text-[#0F0F0F]">
          Admin Access Required
        </h2>
        <p className="mb-6 text-sm text-[#928E82]">
          Please sign in with an administrator account to view payments.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-[#0F0F0F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const act = async (orderId: string, action: 'mark-paid' | 'reject') => {
    if (action === 'reject' && !confirm('Reject this payment?')) return;
    setBusy(orderId + action);
    setError('');
    try {
      if (action === 'mark-paid') await api.markPaymentPaid(orderId);
      else await api.rejectPayment(orderId);
      load();
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
              Payments
            </h1>
            <span className="rounded-full bg-[#F4F3EF] px-2.5 py-0.5 text-xs font-semibold text-[#6E6A5E]">
              {loading ? '…' : `${payments.length} records`}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#928E82]">
            Monitor full settlements, customer installment schedules, and verify bank collections.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-xs font-medium text-[#6E6A5E] shadow-sm transition-all hover:bg-[#FAFAF8] active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* ─── Filter Strip (Horizontally Scrollable on Mobile) ───────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STATUS_FILTERS.map((s) => {
          const active = activeFilter === s.value;
          return (
            <button
              key={s.value || 'ALL'}
              onClick={() => setActiveFilter(s.value)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'bg-[#0F0F0F] text-white shadow-sm'
                  : 'border border-[#EAE8E1] bg-white text-[#6E6A5E] hover:border-[#D5D2C8] hover:text-[#0F0F0F]',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ─── Main Content: Dual Mobile/Desktop Presentation ────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-[#EAE8E1] bg-white p-12 text-center text-sm text-[#928E82]">
          <Loader2 size={18} className="mx-auto mb-2 animate-spin text-[#6E6A5E]" />
          Loading payment records…
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-[#EAE8E1] bg-white py-16 text-center">
          <CreditCard size={28} className="mx-auto mb-2 text-[#D5D2C8]" />
          <p className="text-sm font-medium text-[#0F0F0F]">No payments found</p>
          <p className="mt-0.5 text-xs text-[#928E82]">Try selecting a different filter above.</p>
        </div>
      ) : (
        <>
          {/* 📱 MOBILE VIEW: High-Density Responsive Cards (< md) */}
          <div className="grid gap-3.5 md:hidden">
            {payments.map((p) => {
              const isInstallment =
                p.paymentPlan === 'INSTALLMENT' || (p.installments && p.installments.length > 0);
              const instList = p.installments || [];
              const paidList = instList.filter((i) => i.status === 'COMPLETED');
              const paidSum = paidList.reduce((sum, i) => sum + Number(i.amount), 0);

              return (
                <article
                  key={p.id}
                  className="rounded-xl border border-[#EAE8E1] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md"
                >
                  {/* Card Header: Order Number + Status Badges */}
                  <div className="flex items-start justify-between gap-2 border-b border-[#F4F3EF] pb-3">
                    <div>
                      <Link
                        href={`/admin/orders/${p.orderId}`}
                        className="font-mono text-xs font-semibold text-[#CC0000] hover:underline"
                      >
                        #{p.order.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-[13px] font-medium text-[#0F0F0F]">
                        {p.order.user ? `${p.order.user.firstName} ${p.order.user.lastName}` : 'Guest / Customer'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          statusBadge[p.status] || 'bg-neutral-100 text-neutral-600',
                        )}
                      >
                        {p.status}
                      </span>
                      <span className="rounded bg-[#F4F3EF] px-1.5 py-0.5 text-[10px] font-medium text-[#6E6A5E]">
                        Order: {p.order.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Details: Grid */}
                  <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#928E82]">Method</span>
                      <div className="mt-0.5 font-medium text-[#0F0F0F]">
                        {isInstallment ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#3A5F87]">
                            📅 Installments ({instList.length || 3}x)
                          </span>
                        ) : (
                          <span>{methodIcon[p.method] || '💳'} {p.method}</span>
                        )}
                      </div>
                      {isInstallment && (
                        <p className="mt-0.5 text-[11px] text-[#6E6A5E]">
                          {paidList.length} of {instList.length} settled
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] uppercase tracking-wider text-[#928E82]">Total Amount</span>
                      <div className="mt-0.5 font-display text-sm font-bold text-[#0F0F0F]">
                        {formatLKR(p.amount)}
                      </div>
                      {isInstallment && (
                        <p
                          className={cn(
                            'mt-0.5 text-[11px] font-medium',
                            paidList.length === instList.length ? 'text-emerald-700' : 'text-amber-700',
                          )}
                        >
                          Paid: {formatLKR(paidSum)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-end gap-2 border-t border-[#F4F3EF] pt-3">
                    {isInstallment ? (
                      <Link
                        href={`/account/orders/${p.orderId}/installments`}
                        target="_blank"
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#EAE8E1] bg-[#FAFAF8] text-xs font-semibold text-[#0F0F0F] transition-colors hover:bg-[#F4F3EF]"
                      >
                        <ExternalLink size={12} />
                        View Installment Schedule
                      </Link>
                    ) : p.status === 'COMPLETED' ? (
                      <span className="text-xs font-medium text-emerald-700">
                        ✓ Payment Settled
                      </span>
                    ) : (
                      <div className="flex w-full items-center gap-2">
                        <button
                          disabled={busy === p.orderId + 'mark-paid'}
                          onClick={() => act(p.orderId, 'mark-paid')}
                          className="flex-1 rounded-lg bg-[#0F0F0F] py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black disabled:opacity-50"
                        >
                          {busy === p.orderId + 'mark-paid'
                            ? 'Processing…'
                            : p.method === 'COD'
                              ? 'Mark Collected'
                              : 'Mark Paid'}
                        </button>
                        {p.status !== 'FAILED' && (
                          <button
                            disabled={busy === p.orderId + 'reject'}
                            onClick={() => act(p.orderId, 'reject')}
                            className="rounded-lg border border-[#CC0000]/30 px-3 py-2 text-xs font-semibold text-[#CC0000] transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* 💻 DESKTOP VIEW: Full Data Table (≥ md) */}
          <div className="hidden overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EAE8E1] bg-[#FAFAF8]">
                    {['Order', 'Customer', 'Method / Plan', 'Amount & Collection', 'Payment Status', 'Order Status', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#928E82]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F3EF]">
                  {payments.map((p) => {
                    const isInstallment =
                      p.paymentPlan === 'INSTALLMENT' || (p.installments && p.installments.length > 0);
                    const instList = p.installments || [];
                    const paidList = instList.filter((i) => i.status === 'COMPLETED');
                    const paidSum = paidList.reduce((sum, i) => sum + Number(i.amount), 0);

                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-[#FAFAF8]"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <Link
                            href={`/admin/orders/${p.orderId}`}
                            className="font-mono text-xs font-semibold text-[#CC0000] hover:underline"
                          >
                            #{p.order.orderNumber}
                          </Link>
                        </td>

                        <td className="px-4 py-3.5 text-[13px] text-[#4A4740]">
                          {p.order.user ? (
                            <div>
                              <p className="font-medium text-[#0F0F0F]">
                                {p.order.user.firstName} {p.order.user.lastName}
                              </p>
                              <p className="text-[11px] text-[#928E82]">{p.order.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-[#928E82]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-[13px]">
                          {isInstallment ? (
                            <div>
                              <span className="font-semibold text-[#0F0F0F]">
                                📅 INSTALLMENT ({instList.length || 3}x)
                              </span>
                              <p className="text-[11px] text-[#928E82]">
                                {paidList.length} of {instList.length} settled
                              </p>
                            </div>
                          ) : (
                            <span className="font-medium text-[#4A4740]">
                              {methodIcon[p.method] || ''} {p.method}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-display font-bold tabular-nums text-[#0F0F0F]">
                            {formatLKR(p.amount)}
                          </p>
                          {isInstallment && (
                            <p
                              className={cn(
                                'text-[11px] font-medium',
                                paidList.length === instList.length ? 'text-emerald-700' : 'text-amber-700',
                              )}
                            >
                              Paid: {formatLKR(paidSum)}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              statusBadge[p.status] || 'bg-neutral-100 text-neutral-600',
                            )}
                          >
                            {p.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-flex rounded bg-[#F4F3EF] px-2 py-0.5 text-[10px] font-medium text-[#6E6A5E]">
                            {p.order.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          {isInstallment ? (
                            <Link
                              href={`/account/orders/${p.orderId}/installments`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-md border border-[#EAE8E1] px-2.5 py-1 text-xs font-medium text-[#0F0F0F] transition-colors hover:bg-[#F4F3EF]"
                            >
                              Schedule
                              <ExternalLink size={11} />
                            </Link>
                          ) : p.status === 'COMPLETED' ? (
                            <span className="text-xs text-[#928E82]">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={busy === p.orderId + 'mark-paid'}
                                onClick={() => act(p.orderId, 'mark-paid')}
                                className="rounded-md bg-[#0F0F0F] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
                              >
                                {busy === p.orderId + 'mark-paid'
                                  ? '…'
                                  : p.method === 'COD'
                                    ? 'Mark Collected'
                                    : 'Mark Paid'}
                              </button>
                              {p.status !== 'FAILED' && (
                                <button
                                  disabled={busy === p.orderId + 'reject'}
                                  onClick={() => act(p.orderId, 'reject')}
                                  className="rounded-md border border-[#CC0000]/30 px-2 py-1 text-xs font-medium text-[#CC0000] hover:bg-red-50 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
