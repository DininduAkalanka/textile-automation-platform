'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Order } from '@/types';

function OrderDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isSuccess = searchParams.get('success') === 'true';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getOrderById(id).then(setOrder).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  const statusColors: Record<string, string> = {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-info',
    IN_PRODUCTION: 'badge-info',
    QUALITY_CHECK: 'badge-info',
    COMPLETED: 'badge-success',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-danger',
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Order not found</h2>
        <Link href="/orders" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Orders</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      {/* Success Banner */}
      {isSuccess && (
        <div
          className="animate-fade-in-up"
          style={{
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            border: '1px solid #a7f3d0',
            borderRadius: '1rem',
            padding: '2.5rem',
            textAlign: 'center',
            marginBottom: '2rem',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</p>
          <h2 className="font-display" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#065f46', marginBottom: '0.5rem' }}>
            Order Placed Successfully!
          </h2>
          <p style={{ color: '#047857', fontSize: '0.9375rem' }}>
            Thank you for your purchase. Your order #{order.orderNumber} has been confirmed.
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Order #{order.orderNumber}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`badge ${statusColors[order.status] || 'badge-info'}`} style={{ fontSize: '0.875rem', padding: '0.375rem 1rem' }}>
          {order.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
        {/* Items */}
        <div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Order Items</h3>
            {order.items?.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '0.5rem',
                      background: 'linear-gradient(135deg, hsl(220, 25%, 90%), hsl(250, 30%, 85%))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>🧵</span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 500 }}>{item.product?.name || 'Product'}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      Qty: {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
                <p style={{ fontWeight: 600 }}>${Number(item.totalPrice).toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Shipping Address</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
                {(order.shippingAddress as any).fullName}<br />
                {(order.shippingAddress as any).addressLine1}<br />
                {(order.shippingAddress as any).city}, {(order.shippingAddress as any).state} {(order.shippingAddress as any).postalCode}<br />
                {(order.shippingAddress as any).country}
              </p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div
          style={{
            background: 'white',
            borderRadius: '1rem',
            border: '1px solid var(--color-border-light)',
            padding: '1.5rem',
            position: 'sticky',
            top: '6rem',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Order Summary</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
              <span>${Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Shipping</span>
              <span>${Number(order.shippingCost).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Tax</span>
              <span>${Number(order.tax).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            <span>Total</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>

          {/* Payment Status */}
          {order.payment && (
            <div style={{ padding: '1rem', background: 'var(--color-border-light)', borderRadius: '0.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Payment</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {order.payment.method === 'INSTALLMENT' ? '📅 Installment Plan' : '💳 ' + order.payment.method}
                </span>
                <span className={`badge ${order.payment.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                  {order.payment.status}
                </span>
              </div>
              {order.payment.paymentPlan === 'INSTALLMENT' && (
                <Link
                  href={`/orders/${id}/installments`}
                  className="btn btn-outline-brand btn-sm"
                  style={{ width: '100%', marginTop: '0.75rem', textAlign: 'center' }}
                >
                  View Installment Schedule →
                </Link>
              )}
            </div>
          )}

          <Link href="/orders" className="btn btn-outline" style={{ width: '100%', marginTop: '1.5rem', textAlign: 'center' }}>
            ← Back to Orders
          </Link>
          <Link href="/products" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', textAlign: 'center' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading...</div>}>
      <OrderDetailContent />
    </Suspense>
  );
}
