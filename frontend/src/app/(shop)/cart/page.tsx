'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Ruler } from 'lucide-react';

import { MeasurementDialog } from '@/components/cart/measurement-dialog';
import { Button } from '@/components/ui/button';
import { isComplete, needsMeasurements } from '@/lib/measurements';
import { useCartStore } from '@/store/useCartStore';
import { Product } from '@/types';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    totalItems,
    setMeasurements,
    itemsMissingMeasurements,
    canCheckout,
  } = useCartStore();

  const [measuring, setMeasuring] = useState<Product | null>(null);

  const missing = itemsMissingMeasurements();
  const checkoutAllowed = canCheckout();

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</p>
        <h2 className="font-display" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Your Cart is Empty
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          Looks like you haven&apos;t added any fabrics yet
        </p>
        <Link href="/products" className="btn btn-primary btn-lg">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
        Shopping Cart ({totalItems()} items)
      </h1>

      <div className="cart-layout">
        {/* Cart Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div
              key={item.product.id}
              className="card"
              style={{
                display: 'flex',
                gap: '1.25rem',
                padding: '1.25rem',
                alignItems: 'center',
              }}
            >
              {/* Product Image */}
              <div
                style={{
                  width: '100px',
                  height: '120px',
                  borderRadius: '0.5rem',
                  background: 'var(--warm-100)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {item.product.images && item.product.images.length > 0 ? (
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, var(--warm-100), var(--warm-200))',
                  }}>
                    <span style={{ fontSize: '2rem' }}>🧵</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ flex: 1 }}>
                <Link
                  href={`/products/${item.product.slug}`}
                  style={{
                    textDecoration: 'none',
                    color: 'var(--color-text)',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {item.product.name}
                </Link>
                {item.product.category && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    {item.product.category.name}
                  </p>
                )}
                <p style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  Rs. {Number(item.product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* BR3: a measured garment cannot be ordered until it has measurements. */}
              {needsMeasurements(item.product) && (
                <button
                  onClick={() => setMeasuring(item.product)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    cursor: 'pointer', fontSize: '0.75rem',
                    borderRadius: '0.5rem', padding: '0.375rem 0.75rem',
                    ...(isComplete(item.product, item.measurements)
                      ? { fontWeight: 500, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0' }
                      : { fontWeight: 600, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d' }),
                  }}
                >
                  <Ruler size={12} aria-hidden />
                  {isComplete(item.product, item.measurements)
                    ? `Measured — ${item.measurements?.personName}`
                    : 'Add measurements'}
                </button>
              )}

              {/* Quantity */}
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--color-border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  style={{ padding: '0.375rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  −
                </button>
                <span style={{ padding: '0.375rem 0.625rem', fontSize: '0.875rem', fontWeight: 500, borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  style={{ padding: '0.375rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  +
                </button>
              </div>

              {/* Total */}
              <p style={{ fontSize: '1.0625rem', fontWeight: 700, minWidth: '80px', textAlign: 'right' }}>
                Rs. {(Number(item.product.price) * item.quantity).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </p>

              {/* Remove */}
              <button
                onClick={() => removeItem(item.product.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-light)',
                  padding: '0.375rem',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-light)')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={clearCart}
            className="btn btn-outline btn-sm"
            style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
          >
            Clear Cart
          </button>
        </div>

        {/* Order Summary */}
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
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            Order Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Subtotal ({totalItems()} items)</span>
              <span style={{ fontWeight: 500 }}>Rs. {subtotal().toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Shipping</span>
              <span style={{ fontWeight: 500, color: '#065f46' }}>Free</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Tax</span>
              <span style={{ fontWeight: 500 }}>Rs. 0.00</span>
            </div>
          </div>

          <div
            style={{
              borderTop: '2px solid var(--color-border)',
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.125rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
            }}
          >
            <span>Total</span>
            <span>Rs. {subtotal().toLocaleString('en-LK', { minimumFractionDigits: 2 })}</span>
          </div>

          {/* BR3 (doc 01 §7): checkout is blocked while any measured garment is
              missing its measurements. Blocked rather than hidden, with the
              reason stated — a disabled button that does not say why is worse
              than no button (doc 10 §13). The API enforces this regardless. */}
          {!checkoutAllowed && missing.length > 0 && (
            <div
              role="alert"
              style={{
                display: 'flex', gap: '0.5rem',
                background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: '0.5rem', padding: '0.75rem',
                marginBottom: '0.75rem', fontSize: '0.8125rem', color: '#92400e',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden />
              <span>
                Measurements needed for{' '}
                <strong>{missing.map((i) => i.product.name).join(', ')}</strong>{' '}
                before you can check out.
              </span>
            </div>
          )}

          {checkoutAllowed ? (
            <Link
              href="/checkout"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              Proceed to Checkout
            </Link>
          ) : (
            <Button size="lg" disabled className="mb-3 w-full">
              Proceed to Checkout
            </Button>
          )}

          <Link href="/products" className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
            Continue Shopping
          </Link>
        </div>
      </div>

      <MeasurementDialog
        product={measuring}
        existing={
          items.find((i) => i.product.id === measuring?.id)?.measurements
        }
        open={measuring !== null}
        onOpenChange={(open) => !open && setMeasuring(null)}
        onSave={(set) => {
          if (measuring) setMeasurements(measuring.id, set);
        }}
      />
    </div>
  );
}
