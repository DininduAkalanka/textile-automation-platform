'use client';

import { Suspense, use, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { OrderTrackingStepper } from '@/components/orders/order-tracking-stepper';
import { useCancelMyOrder, useOrder } from '@/hooks/use-orders';
import { api } from '@/lib/api';

const fmt = (n: number | string) =>
  'Rs. ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 });

function OrderDetailContent({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';

  const { data: order, isLoading, isError } = useOrder(orderId);
  const cancel = useCancelMyOrder();
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function retryPayment() {
    if (!order) return;
    setRetrying(true);
    try {
      const { checkoutUrl, params } = await api.createPayherePayment(order.id);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = checkoutUrl;
      Object.entries(params).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value ?? '');
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch {
      setRetrying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Order not found</h2>
        <Link href="/account/orders" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Orders
        </Link>
      </div>
    );
  }

  // Plan 7.1 task 3: "Cancel button only in PENDING." The server independently
  // enforces the same rule (orders.service.ts's cancel()) — this only decides
  // whether to SHOW the button; it is not the security boundary.
  const canCancel = order.status === 'PENDING';
  const canRetryPayment = order.payment?.status === 'FAILED' && order.payment.method === 'PAYHERE';

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {order.orderNumber}
          </h1>
          <p style={{ color: 'var(--clr-text-2)', fontSize: '0.875rem' }}>
            Placed on{' '}
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
        <div>
          {/* Tracking (task 3's centrepiece) */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem' }}>Tracking</h3>
            <OrderTrackingStepper order={order} />
          </div>

          {/* Items + measurements recap */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Order Items</h3>
            {order.items?.map((item) => (
              <div key={item.id} style={{ padding: '1rem 0', borderBottom: '1px solid var(--clr-border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '0.5rem',
                        background: 'linear-gradient(135deg, hsl(220, 25%, 90%), hsl(250, 30%, 85%))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: '1.375rem' }}>🧵</span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 500 }}>{item.product?.name || 'Product'}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                        Qty: {item.quantity} × {fmt(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontWeight: 600 }}>{fmt(item.totalPrice)}</p>
                </div>

                {/* BR3 — measurements snapshotted at checkout. */}
                {item.measurements && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      marginLeft: '68px',
                      padding: '0.75rem 1rem',
                      background: 'var(--clr-surface-2)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-text-2)', marginBottom: '0.375rem' }}>
                      Measurements — {item.measurements.personName}
                      {item.measurements.label ? ` (${item.measurements.label})` : ''}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.375rem 1rem' }}>
                      {Object.entries(item.measurements.values).map(([key, value]) => (
                        <p key={key} style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)' }}>
                          <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>:{' '}
                          <strong style={{ color: 'var(--clr-text)' }}>{value} cm</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Shipping Address</h3>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--clr-text-2)' }}>
                {order.shippingAddress.fullName}<br />
                {order.shippingAddress.addressLine1}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                {order.shippingAddress.country}
              </p>
            </div>
          )}

          {/* Full status history feed (task 1's "who/when/note", also useful to
              a customer who wants the raw record rather than the summary). */}
          {order.statusHistory && order.statusHistory.length > 1 && (
            <div className="card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {order.statusHistory.map((h) => (
                  <div key={h.id} style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                    <strong style={{ color: 'var(--clr-text)' }}>{h.toStatus}</strong>
                    {' — '}
                    {new Date(h.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {h.note && <span style={{ fontStyle: 'italic' }}> — &ldquo;{h.note}&rdquo;</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '6rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Order Summary</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--clr-text-2)' }}>Subtotal</span>
              <span>{fmt(order.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--clr-text-2)' }}>Shipping</span>
              <span>{fmt(order.shippingCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--clr-text-2)' }}>Tax</span>
              <span>{fmt(order.tax)}</span>
            </div>
          </div>

          <div style={{ borderTop: '2px solid var(--clr-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            <span>Total</span>
            <span>{fmt(order.total)}</span>
          </div>

          {order.payment && (
            <div style={{ padding: '1rem', background: 'var(--clr-surface-2)', borderRadius: '0.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)', marginBottom: '0.25rem' }}>Payment</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {order.payment.method === 'INSTALLMENT' ? '📅 Installment Plan' : '💳 ' + order.payment.method}
                </span>
                <span
                  className={`badge ${
                    order.payment.status === 'COMPLETED'
                      ? 'badge-success'
                      : order.payment.status === 'FAILED'
                        ? 'badge-danger'
                        : 'badge-warn'
                  }`}
                >
                  {order.payment.status}
                </span>
              </div>
              {order.payment.paymentPlan === 'INSTALLMENT' && (
                <Link
                  href={`/account/orders/${orderId}/installments`}
                  className="btn btn-outline-brand btn-sm"
                  style={{ width: '100%', marginTop: '0.75rem', textAlign: 'center' }}
                >
                  View Installment Schedule →
                </Link>
              )}
              {canRetryPayment && (
                <button
                  onClick={retryPayment}
                  disabled={retrying}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', marginTop: '0.75rem' }}
                >
                  {retrying ? 'Redirecting…' : 'Retry Payment'}
                </button>
              )}
            </div>
          )}

          {canCancel && (
            <button
              onClick={() => {
                setCancelling(true);
                cancel.mutate(
                  { id: order.id },
                  { onSettled: () => setCancelling(false) },
                );
              }}
              disabled={cancelling}
              className="btn btn-outline"
              style={{ width: '100%', marginTop: '1rem', textAlign: 'center', borderColor: '#DC2626', color: '#DC2626' }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </button>
          )}

          <Link href="/account/orders" className="btn btn-outline" style={{ width: '100%', marginTop: '0.75rem', textAlign: 'center' }}>
            ← Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading...</div>}>
      <OrderDetailContent orderId={id} />
    </Suspense>
  );
}
