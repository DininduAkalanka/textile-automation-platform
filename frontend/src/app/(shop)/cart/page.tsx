'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Ruler, ShoppingBag } from 'lucide-react';

import { MeasurementDialog } from '@/components/cart/measurement-dialog';
import { Button } from '@/components/ui/button';
import { isComplete, needsMeasurements } from '@/lib/measurements';
import { normalizeImageUrl } from '@/lib/image-url';
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
      <div className="container mx-auto px-4 py-16 text-center max-w-3xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--clr-surface-2)] text-[var(--clr-brand)] border border-[var(--clr-border-2)]">
          <ShoppingBag size={36} strokeWidth={1.5} />
        </div>

        <h2 className="font-display text-2xl font-bold sm:text-3xl text-neutral-900 mb-2">
          Your Shopping Bag is Empty
        </h2>

        <p className="text-sm text-neutral-600 max-w-md mx-auto mb-8">
          Explore our curated fabrics, school uniforms, and custom tailored wear. Add items to your bag to enjoy seamless checkout.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link href="/products" className="btn btn-primary btn-lg inline-flex items-center gap-2">
            Start Shopping
          </Link>
          <Link href="/products?category=uniforms" className="btn btn-outline btn-lg inline-flex items-center gap-2">
            School &amp; Office Uniforms
          </Link>
        </div>

        {/* Quick Category Discoveries */}
        <div className="rounded-xl border border-neutral-200 bg-[var(--clr-surface)] p-6 mb-10 text-left">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500 mb-4 text-center sm:text-left">
            Explore Popular Collections
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'School Uniforms', href: '/products?category=uniforms' },
              { label: 'Women’s Sarees', href: '/products?category=women&sub=sarees' },
              { label: 'Men’s Shirts', href: '/products?category=men&sub=shirts' },
              { label: 'Dress Materials', href: '/products?category=women&sub=dress-materials' },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[var(--clr-surface-2)] border border-neutral-100 hover:border-[var(--clr-brand)] transition text-center group"
              >
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-[var(--clr-brand)]">{cat.label}</span>
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5">Explore →</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Customer Trust Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-neutral-200 text-left text-xs text-neutral-600">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
            <span className="text-xl">🚚</span>
            <div>
              <p className="font-semibold text-neutral-900">Islandwide Delivery</p>
              <p className="text-[11px] text-neutral-500">Fast 2-4 business day shipping</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
            <span className="text-xl">💳</span>
            <div>
              <p className="font-semibold text-neutral-900">Interest-Free BNPL</p>
              <p className="text-[11px] text-neutral-500">3 installments with KOKO / Mintpay</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
            <span className="text-xl">🔄</span>
            <div>
              <p className="font-semibold text-neutral-900">14-Day Exchange</p>
              <p className="text-[11px] text-neutral-500">Hassle-free size or fit swaps</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
        Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'}
        {totalItems() > items.length ? ` · ${totalItems()} units` : ''})
      </h1>

      <div className="cart-layout">
        {/* Cart Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => (
            <div
              key={item.product.id}
              className="card flex flex-col gap-3.5 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
            >
              {/* Image + details */}
              <div className="flex gap-3.5 items-start sm:contents">
                {/* Product Image */}
                <div
                  style={{
                    width: '80px',
                    height: '100px',
                    borderRadius: '0.5rem',
                    background: 'var(--warm-100)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {item.product.images && item.product.images.length > 0 ? (
                    <img
                      src={normalizeImageUrl(item.product.images[0])}
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={`/products/${item.product.slug}`}
                    style={{
                      textDecoration: 'none',
                      color: 'var(--color-text)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.product.name}
                  </Link>
                  {item.product.category && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      {item.product.category.name}
                    </p>
                  )}
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.375rem', color: 'var(--clr-text-2)' }}>
                    Rs.&nbsp;{Number(item.product.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* BR3: Measurement action (full width on mobile, inline on desktop) */}
              {needsMeasurements(item.product) && (
                <div className="w-full sm:w-auto">
                  <button
                    data-testid="cart-add-measurements-btn"
                    onClick={() => setMeasuring(item.product)}
                    className="w-full sm:w-auto"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                      cursor: 'pointer', fontSize: '0.75rem',
                      borderRadius: '0.5rem', padding: '0.5rem 0.875rem',
                      ...(isComplete(item.product, item.measurements)
                        ? { fontWeight: 500, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0' }
                        : { fontWeight: 600, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d' }),
                    }}
                  >
                    <Ruler size={13} aria-hidden />
                    <span>
                      {isComplete(item.product, item.measurements)
                        ? `Measured — ${item.measurements?.personName}`
                        : 'Add Custom Measurements'}
                    </span>
                  </button>
                </div>
              )}

              {/* Bottom row on mobile (stepper + total + delete) / inline on desktop */}
              <div className="flex items-center justify-between sm:contents pt-3 sm:pt-0 border-t border-neutral-100 sm:border-t-0">
                {/* Quantity */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--color-border)', borderRadius: '0.5rem', overflow: 'hidden', background: 'white' }}>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span style={{ minWidth: '1.75rem', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', lineHeight: '2rem' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {/* Total & Remove */}
                <div className="flex items-center gap-3 ml-auto sm:ml-0">
                  <p style={{ fontSize: '1.0625rem', fontWeight: 700, minWidth: '80px', textAlign: 'right', margin: 0 }}>
                    Rs.&nbsp;{(Number(item.product.price) * item.quantity).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </p>

                  <button
                    onClick={() => removeItem(item.product.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-light)',
                      width: '2.5rem',
                      height: '2.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      transition: 'color 0.2s, background 0.2s',
                    }}
                    aria-label={`Remove ${item.product.name} from cart`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#dc2626';
                      e.currentTarget.style.background = '#fef2f2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-light)';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <button
              data-testid="cart-clear-btn"
              onClick={clearCart}
              className="btn btn-outline btn-sm"
            >
              Clear Cart
            </button>
          </div>
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
              <span style={{ color: 'var(--color-text-muted)' }}>
                Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'}
                {totalItems() > items.length ? ` · ${totalItems()} units` : ''})
              </span>
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
              data-testid="cart-proceed-to-checkout-btn"
              href="/checkout"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              Proceed to Checkout
            </Link>
          ) : (
            <Button data-testid="cart-proceed-to-checkout-btn" size="lg" disabled className="mb-3 w-full">
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
