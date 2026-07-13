'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminPayment } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { formatLKR } from '@/lib/format';

const statusBadge: Record<string, string> = {
  PENDING: 'badge-warning',
  COMPLETED: 'badge-success',
  FAILED: 'badge-danger',
  REFUNDED: 'badge-info',
};

const methodIcon: Record<string, string> = {
  PAYHERE: '💳',
  COD: '💵',
  INSTALLMENT: '📅',
  STRIPE: '💳',
};

const STATUS_FILTERS = ['', 'PENDING', 'COMPLETED', 'FAILED'];

export default function AdminPaymentsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getAllPayments(1, 50, statusFilter ? { status: statusFilter } : undefined)
      .then((res) => setPayments(res.payments || []))
      .catch((e: any) => setError(e.message || 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') load();
    else setLoading(false);
  }, [isAuthenticated, user, load]);

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Admin Access Required</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Please sign in with an admin account</p>
        <Link href="/login" className="btn btn-primary">Sign In</Link>
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
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700 }}>Payments</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Verify bank transfers, mark COD collected, or reject</p>
        </div>
        <Link href="/admin" className="btn btn-outline btn-sm">← Dashboard</Link>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem' }}><div className="skeleton" style={{ height: '240px' }} /></div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No payments found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  {['Order', 'Customer', 'Method', 'Amount', 'Payment', 'Order Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                      <Link href={`/admin/orders/${p.orderId}`} style={{ color: 'var(--color-accent)' }}>#{p.order.orderNumber}</Link>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {p.order.user ? `${p.order.user.firstName} ${p.order.user.lastName}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{methodIcon[p.method] || ''} {p.method}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{formatLKR(p.amount)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${statusBadge[p.status] || 'badge-info'}`}>{p.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge badge-info">{p.order.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {p.status === 'COMPLETED' ? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy === p.orderId + 'mark-paid'}
                            onClick={() => act(p.orderId, 'mark-paid')}
                          >
                            {busy === p.orderId + 'mark-paid' ? '…' : p.method === 'COD' ? 'Mark Collected' : 'Mark Paid'}
                          </button>
                          {p.status !== 'FAILED' && (
                            <button
                              className="btn btn-sm btn-outline"
                              disabled={busy === p.orderId + 'reject'}
                              onClick={() => act(p.orderId, 'reject')}
                            >
                              {busy === p.orderId + 'reject' ? '…' : 'Reject'}
                            </button>
                          )}
                        </div>
                      )}
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
