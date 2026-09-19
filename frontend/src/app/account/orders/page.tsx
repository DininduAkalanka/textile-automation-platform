'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { useMyOrders } from '@/hooks/use-orders';
import { useAuthStore } from '@/store/useAuthStore';
import { OrderStatus } from '@/types';
import { normalizeImageUrl } from '@/lib/image-url';

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

/** Customer /account/orders: list w/ status pills and product photo previews */
export default function AccountOrdersPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { isAuthenticated } = useAuthStore();
  const { data, isLoading, isError } = useMyOrders(1, 20);

  if (!mounted) {
    return (
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
          My Orders
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '120px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Please sign in</h2>
        <Link href="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
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
              data-testid="customer-order-card"
              className="card group hover:border-neutral-400 hover:shadow-md transition-all duration-200"
              style={{
                padding: '1.25rem 1.5rem',
                textDecoration: 'none',
                color: 'var(--clr-text)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}
            >
              {/* Order Meta Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <p data-testid="customer-order-number" style={{ fontWeight: 600, marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </div>

              {/* Order Products Preview Gallery (Photos, Names, Quantities) */}
              {order.items && order.items.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pt-2 border-t border-neutral-100 no-scrollbar">
                  {order.items.map((item, idx) => {
                    const imgSrc = item.product?.images?.[0]
                      ? normalizeImageUrl(item.product.images[0])
                      : null;
                    return (
                      <div
                        key={item.id || idx}
                        className="flex items-center gap-2.5 bg-neutral-50/80 hover:bg-neutral-100/80 border border-neutral-200/80 rounded-lg p-2 shrink-0 transition-colors"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden bg-white border border-neutral-200 shrink-0 relative">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item.product?.name || 'Product'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                              <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="max-w-[140px] sm:max-w-[200px] text-left">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {item.product?.name || 'Textile / Custom Garment'}
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Qty: {item.quantity} · {fmt(item.unitPrice)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
