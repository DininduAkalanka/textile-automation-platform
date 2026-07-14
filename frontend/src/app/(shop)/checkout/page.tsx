'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';

type PaymentMethod = 'payhere' | 'cod';

const fmt = (n: number) =>
  'Rs ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Redirect the browser to PayHere by auto-submitting a hidden form POST. */
function postToPayHere(actionUrl: string, params: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  Object.entries(params).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value ?? '');
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function MethodCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  right,
  rightSub,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  subtitle: string;
  right?: string;
  rightSub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        border: selected ? '2px solid var(--clr-brand)' : '1.5px solid var(--clr-border)',
        borderRadius: 'var(--r-lg)',
        padding: '1.5rem',
        marginBottom: '1rem',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        background: selected ? 'var(--clr-brand-tint)' : 'var(--clr-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '3rem', height: '3rem', borderRadius: 'var(--r-md)',
          background: selected ? 'var(--clr-brand)' : 'var(--clr-surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
        }}>
          {selected ? '✓' : icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--clr-text)' }}>{title}</h3>
            {selected && <span className="badge badge-brand" style={{ fontSize: '0.6rem' }}>SELECTED</span>}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)', marginTop: '0.25rem' }}>{subtitle}</p>
        </div>
        {right && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--clr-text)' }}>{right}</p>
            {rightSub && <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)' }}>{rightSub}</p>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Address, 2: Payment, 3: Confirm

  const [method, setMethod] = useState<PaymentMethod>('payhere');

  const [address, setAddress] = useState({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Sri Lanka',
    phone: '',
  });

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>No items in your cart</h2>
        <Link href="/products" className="btn btn-primary">Shop Now</Link>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Please sign in to checkout</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>You need an account to place an order</p>
        <Link href="/login" className="btn btn-primary btn-lg">Sign In</Link>
      </div>
    );
  }

  const totalValue = subtotal();

  const methodLabel: Record<PaymentMethod, string> = {
    payhere: 'Card / Online Payment',
    cod: 'Cash on Delivery',
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Create the order (server reserves stock).
      const order = await api.createOrder({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          // BR3. The server re-validates these against the product row and
          // rejects the order if any are missing, so this is a transport, not
          // a trust boundary.
          measurements: item.measurements,
        })),
        shippingAddress: address,
      });

      // 2. Start payment based on the chosen method.
      if (method === 'cod') {
        // COD confirms the order immediately server-side.
        await api.createCodPayment(order.id);
        clearCart();
        router.push(`/account/orders/${order.id}?success=true`);
        return;
      }

      // Redirect to PayHere; the notify webhook confirms the order.
      const { checkoutUrl, params } = await api.createPayherePayment(order.id);
      clearCart();
      postToPayHere(checkoutUrl, params);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const isAddressValid = address.fullName && address.addressLine1 && address.city && address.state && address.postalCode && address.country;

  const stepLabels = [
    { num: 1, label: 'Shipping' },
    { num: 2, label: 'Payment' },
    { num: 3, label: 'Review & Pay' },
  ];

  const placeOrderLabel =
    method === 'cod'
      ? `Place Order — ${fmt(totalValue)}`
      : `Pay with PayHere — ${fmt(totalValue)}`;

  return (
    <div className="container" style={{ padding: '2rem 0 4rem' }}>
      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
        Checkout
      </h1>

      {/* Progress Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
        {stepLabels.map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '2rem', height: '2rem', borderRadius: '50%',
                background: step >= s.num ? 'var(--color-accent)' : 'var(--color-border)',
                color: step >= s.num ? 'white' : 'var(--color-text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.3s',
              }}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: step === s.num ? 600 : 400, color: step === s.num ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
              {s.label}
            </span>
            {i < 2 && <div style={{ width: '3rem', height: '2px', background: step > s.num ? 'var(--color-accent)' : 'var(--color-border)', margin: '0 0.5rem' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem', alignItems: 'start' }}>
        {/* Main Content */}
        <div>
          {/* STEP 1: Shipping Address */}
          {step === 1 && (
            <div className="card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Shipping Address</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Full Name *</label>
                  <input className="input" name="fullName" value={address.fullName} onChange={handleChange} placeholder="John Doe" required />
                </div>
                <div>
                  <label className="input-label">Address Line 1 *</label>
                  <input className="input" name="addressLine1" value={address.addressLine1} onChange={handleChange} placeholder="123 Main Street" required />
                </div>
                <div>
                  <label className="input-label">Address Line 2</label>
                  <input className="input" name="addressLine2" value={address.addressLine2} onChange={handleChange} placeholder="Apt 4B" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">City *</label>
                    <input className="input" name="city" value={address.city} onChange={handleChange} placeholder="Colombo" required />
                  </div>
                  <div>
                    <label className="input-label">State / Province *</label>
                    <input className="input" name="state" value={address.state} onChange={handleChange} placeholder="Western Province" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="input-label">Postal Code *</label>
                    <input className="input" name="postalCode" value={address.postalCode} onChange={handleChange} placeholder="10100" required />
                  </div>
                  <div>
                    <label className="input-label">Country *</label>
                    <input className="input" name="country" value={address.country} onChange={handleChange} placeholder="Sri Lanka" required />
                  </div>
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input className="input" name="phone" value={address.phone} onChange={handleChange} placeholder="+94 77 123 4567" />
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setStep(2)}
                  disabled={!isAddressValid}
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment Method Selection */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Choose Payment Method</h2>

              <MethodCard
                selected={method === 'payhere'}
                onSelect={() => setMethod('payhere')}
                icon="💳"
                title="Card / Online Payment"
                subtitle="Visa, Mastercard or online banking — secured by PayHere"
                right={fmt(totalValue)}
                rightSub="Pay now"
              />

              <MethodCard
                selected={method === 'cod'}
                onSelect={() => setMethod('cod')}
                icon="💵"
                title="Cash on Delivery"
                subtitle="Pay in cash when your order is delivered"
                right={fmt(totalValue)}
                rightSub="On delivery"
              />

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn btn-outline btn-lg" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => setStep(3)}>
                  Continue to Review
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Confirm */}
          {step === 3 && (
            <div>
              {/* Address Review */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Shipping Address</h3>
                  <button onClick={() => setStep(1)} className="btn btn-outline btn-sm">Edit</button>
                </div>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
                  {address.fullName}<br />
                  {address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}<br />
                  {address.city}, {address.state} {address.postalCode}<br />
                  {address.country}
                  {address.phone && <><br />{address.phone}</>}
                </p>
              </div>

              {/* Payment Method Review */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment Method</h3>
                  <button onClick={() => setStep(2)} className="btn btn-outline btn-sm">Change</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{method === 'payhere' ? '💳' : '💵'}</span>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--clr-text)' }}>{methodLabel[method]}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                      {method === 'payhere' && <>Pay <strong>{fmt(totalValue)}</strong> securely via PayHere</>}
                      {method === 'cod' && <>Pay <strong>{fmt(totalValue)}</strong> in cash on delivery</>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Review */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Order Items</h3>
                {items.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{item.product.name}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Qty: {item.quantity} × {fmt(Number(item.product.price))}</p>
                    </div>
                    <p style={{ fontWeight: 600 }}>{fmt(Number(item.product.price) * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-outline btn-lg" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handlePlaceOrder} disabled={loading}>
                  {loading ? 'Processing…' : placeOrderLabel}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {items.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{item.product.name} × {item.quantity}</span>
                <span>{fmt(Number(item.product.price) * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
              <span>{fmt(totalValue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Shipping</span>
              <span style={{ color: '#065f46' }}>Free</span>
            </div>
          </div>

          <div style={{ borderTop: '2px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 700 }}>
            <span>Total</span>
            <span>{fmt(totalValue)}</span>
          </div>

          {step >= 2 && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--r-md)', background: 'var(--clr-surface-2)', border: '1px solid var(--clr-border-2)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)', fontWeight: 500 }}>
                {method === 'payhere' && <>💳 Card / Online — {fmt(totalValue)}</>}
                {method === 'cod' && <>💵 Cash on Delivery — {fmt(totalValue)}</>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
