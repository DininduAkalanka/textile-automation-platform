'use client';

import Link from 'next/link';

import { useMyOrders } from '@/hooks/use-orders';
import { useAuthStore } from '@/store/useAuthStore';
import { OrderStatus } from '@/types';

const fmt = (n: number | string) =>
  'Rs. ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 });

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: 'badge-warn',
  CONFIRMED: 'badge-info',
  IN_PRODUCTION: 'badge-info',
  QUALITY_CHECK: 'badge-info',
  COMPLETED: 'badge-success',
  DELIVERED: 'badge-success',
  CANCELLED: 'badge-danger',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In production',
  QUALITY_CHECK: 'Quality check',
  COMPLETED: 'Completed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Plan Session 7.1, task 3 — "Customer /account/orders: list w/ status pills." */
export default function AccountOrdersPage() {
  const { isAuthenticated } = useAuthStore();
  const { data, isLoading, isError } = useMyOrders(1, 20);

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Please sign in</h2>
        <Link href="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
        My Orders
      </h1>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '120px' }} />
          ))}
        </div>
      ) : isError ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{ color: 'var(--clr-text-2)' }}>Could not load your orders. Please try again.</p>
        </div>
      ) : !data || data.orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</p>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No orders yet</h3>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>Start shopping to place your first order!</p>
          <Link href="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data.orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="card"
              style={{
                padding: '1.25rem 1.5rem',
                textDecoration: 'none',
                color: 'var(--clr-text)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {order.orderNumber}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {' · '}
                  {order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <span className={`badge ${STATUS_BADGE[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
                <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{fmt(order.total)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
