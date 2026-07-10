'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Order } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

export default function OrdersPage() {
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      api.getOrders(1, 20).then((res) => setOrders(res.orders || [])).catch(console.error).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const statusColors: Record<string, string> = {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-info',
    IN_PRODUCTION: 'badge-info',
    QUALITY_CHECK: 'badge-info',
    COMPLETED: 'badge-success',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

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
      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>My Orders</h1>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: '120px' }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</p>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No orders yet</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Start shopping to place your first order!</p>
          <Link href="/products" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="card"
              style={{
                padding: '1.25rem 1.5rem',
                textDecoration: 'none',
                color: 'var(--color-text)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Order #{order.orderNumber}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}
                  {order.items?.length || 0} items
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span className={`badge ${statusColors[order.status] || 'badge-info'}`}>{order.status}</span>
                <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>${Number(order.total).toFixed(2)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
