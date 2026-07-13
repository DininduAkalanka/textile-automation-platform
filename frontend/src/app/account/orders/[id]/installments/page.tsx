'use client';

import { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatLKR } from '@/lib/format';
import { InstallmentSchedule } from '@/types';

export default function InstallmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';

  const [schedule, setSchedule] = useState<InstallmentSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [orderId]);

  const loadSchedule = async () => {
    try {
      const data = await api.getInstallmentSchedule(orderId);
      setSchedule(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load installment schedule');
    } finally {
      setLoading(false);
    }
  };

  const handlePayInstallment = async (installmentId: string) => {
    setPayingId(installmentId);
    setError('');
    try {
      // Create a payment intent for this installment
      await api.payInstallment(installmentId);
      // In mock mode, confirm it immediately
      await api.confirmInstallment(installmentId);
      // Reload schedule
      await loadSchedule();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="skeleton" style={{ width: '2rem', height: '2rem', borderRadius: '50%', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--clr-text-2)' }}>Loading installment schedule...</p>
      </div>
    );
  }

  if (error && !schedule) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h2>
        <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>{error}</p>
        <Link href="/account/orders" className="btn btn-primary">Back to Orders</Link>
      </div>
    );
  }

  if (!schedule) return null;

  const paidCount = schedule.installments.filter((inst) => inst.status === 'COMPLETED').length;
  const totalCount = schedule.installments.length;
  const progressPercent = (paidCount / totalCount) * 100;

  return (
    <div className="container" style={{ padding: '2rem 0 4rem', maxWidth: '860px', margin: '0 auto' }}>
      {/* Success Banner */}
      {isSuccess && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          borderRadius: 'var(--r-lg)',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          animation: 'fadeInUp 0.4s ease both',
        }}>
          <span style={{ fontSize: '2rem' }}>🎉</span>
          <div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#166534' }}>Order Placed Successfully!</h3>
            <p style={{ fontSize: '0.875rem', color: '#15803d' }}>
              Your first installment has been processed. See the schedule below for upcoming payments.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <p className="label-eyebrow" style={{ marginBottom: '0.5rem' }}>Installment Plan</p>
          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700 }}>
            Order {schedule.orderNumber}
          </h1>
        </div>
        <Link href={`/account/orders/${orderId}`} className="btn btn-outline btn-sm">
          View Order Details
        </Link>
      </div>

      {/* Progress Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--clr-text-2)' }}>Payment Progress</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--clr-text)', marginTop: '0.25rem' }}>
              {paidCount} of {totalCount} paid
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--clr-text-2)' }}>Total Amount</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--clr-text)', marginTop: '0.25rem' }}>
              {formatLKR(schedule.totalAmount)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: 'var(--clr-surface-3)',
          borderRadius: 'var(--r-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: paidCount === totalCount
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, var(--clr-brand), var(--crimson-400))',
            borderRadius: 'var(--r-full)',
            transition: 'width 0.6s ease',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>
            {paidCount === totalCount ? '✅ All installments completed' : `${totalCount - paidCount} payment${totalCount - paidCount > 1 ? 's' : ''} remaining`}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>{Math.round(progressPercent)}%</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Installment Schedule Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'var(--clr-surface-2)',
          borderBottom: '1px solid var(--clr-border-2)',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment Schedule</h2>
        </div>

        {schedule.installments.map((inst, index) => {
          const isPaid = inst.status === 'COMPLETED';
          const isOverdue = !isPaid && new Date(inst.dueDate) < new Date();
          const isNext = !isPaid && schedule.installments.findIndex((i) => i.status !== 'COMPLETED') === index;
          const dueDate = new Date(inst.dueDate);

          return (
            <div
              key={inst.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: index < schedule.installments.length - 1 ? '1px solid var(--clr-border-2)' : 'none',
                background: isPaid ? '#f0fdf4' : isNext ? 'var(--clr-brand-tint)' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Status Icon */}
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isPaid
                    ? '#dcfce7'
                    : isOverdue
                    ? '#fef2f2'
                    : isNext
                    ? 'var(--clr-brand)'
                    : 'var(--clr-surface-3)',
                  color: isPaid
                    ? '#16a34a'
                    : isOverdue
                    ? '#dc2626'
                    : isNext
                    ? '#fff'
                    : 'var(--clr-text-3)',
                  fontWeight: 700,
                  fontSize: isPaid ? '1.125rem' : '0.75rem',
                  flexShrink: 0,
                }}>
                  {isPaid ? '✓' : inst.installmentNo}
                </div>

                {/* Details */}
                <div>
                  <p style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--clr-text)',
                  }}>
                    Installment {inst.installmentNo}
                    {isNext && <span className="badge badge-brand" style={{ marginLeft: '0.5rem', fontSize: '0.55rem' }}>NEXT</span>}
                    {isOverdue && <span className="badge badge-danger" style={{ marginLeft: '0.5rem', fontSize: '0.55rem' }}>OVERDUE</span>}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                    {isPaid
                      ? `Paid on ${inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}`
                      : `Due ${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    }
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <p style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: isPaid ? '#16a34a' : 'var(--clr-text)',
                }}>
                  {formatLKR(inst.amount)}
                </p>

                {!isPaid && isNext && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePayInstallment(inst.id)}
                    disabled={payingId === inst.id}
                    style={{ minWidth: '100px' }}
                  >
                    {payingId === inst.id ? 'Paying...' : 'Pay Now'}
                  </button>
                )}

                {isPaid && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    PAID ✓
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Back to Orders */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/account/orders" className="btn btn-outline">
          ← Back to My Orders
        </Link>
      </div>
    </div>
  );
}
