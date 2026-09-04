'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldCheck, Lock, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

type PaymentMethod = 'payhere' | 'cod' | 'installment';

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
  testId,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  subtitle: string;
  right?: string;
  rightSub?: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div style={{
            width: '2.75rem', height: '2.75rem', borderRadius: 'var(--r-md)',
            background: selected ? 'var(--clr-brand)' : 'var(--clr-surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
            color: selected ? '#fff' : 'inherit', flexShrink: 0,
          }}>
            {selected ? '✓' : icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--clr-text)', margin: 0 }}>{title}</h3>
              {selected && <span className="badge badge-brand" style={{ fontSize: '0.6rem' }}>SELECTED</span>}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-2)', marginTop: '0.25rem' }}>{subtitle}</p>
          </div>
        </div>
        {right && (
          <div className="pl-14 sm:pl-0 sm:text-right border-t border-neutral-100 pt-2 sm:border-t-0 sm:pt-0">
            <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--clr-text)', margin: 0 }}>{right}</p>
            {rightSub && <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: '0.125rem' }}>{rightSub}</p>}
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
  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Address & Contact, 2: Payment, 3: Confirm

  const [method, setMethod] = useState<PaymentMethod>('payhere');

  // Contact fields (for both guest & authenticated)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Inline OTP verification states (for COD / guest verification)
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');

  const [address, setAddress] = useState({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Western Province',
    postalCode: '',
    country: 'Sri Lanka',
    phone: '',
  });

  // Auto-populate when user is logged in
  useEffect(() => {
    if (user) {
      if (user.email) setEmail(user.email);
      if (user.phone) setPhone(user.phone);
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (name) {
        setAddress((prev) => ({
          ...prev,
          fullName: prev.fullName || name,
          phone: prev.phone || user.phone || '',
        }));
      }
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>No items in your cart</h2>
        <Link href="/products" className="btn btn-primary">Shop Now</Link>
      </div>
    );
  }

  const totalValue = subtotal();

  const methodLabel: Record<PaymentMethod, string> = {
    payhere: 'Card / Online Payment',
    cod: 'Cash on Delivery',
    installment: 'Monthly Installments (3x Plan)',
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    setOtpError('');
    try {
      if (isAuthenticated) {
        await api.sendVerificationCode('EMAIL');
      }
      setOtpSent(true);
    } catch (err: any) {
      setOtpError(err.message || 'Could not send verification code.');
    } finally {
      setOtpSending(false);
    }
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const orderPayloadItems = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        measurements: item.measurements,
      }));

      const resolvedPhone = address.phone || phone;
      const resolvedEmail = email || user?.email || '';

      // A. Guest Checkout Flow (Express & Frictionless)
      if (!isAuthenticated) {
        const guestRes = await api.guestCheckout({
          items: orderPayloadItems,
          shippingAddress: {
            ...address,
            phone: resolvedPhone,
          },
          email: resolvedEmail,
          phone: resolvedPhone,
          fullName: address.fullName,
          paymentMethod: method.toUpperCase() as any,
          verificationCode: otpCode || undefined,
          password: password || undefined,
        });

        // Silently log in the newly provisioned account
        if (guestRes.session?.user && guestRes.session?.accessToken) {
          setAuth(guestRes.session.user, guestRes.session.accessToken);
        }

        const order = guestRes.order;

        if (method === 'cod') {
          clearCart();
          router.push(`/account/orders/${order.id}?success=true`);
          return;
        }

        if (method === 'installment') {
          await api.createInstallmentPayment(order.id, 3);
          clearCart();
          router.push(`/account/orders/${order.id}/installments?success=true`);
          return;
        }

        // PayHere Payment
        const { checkoutUrl, params } = await api.createPayherePayment(order.id);
        clearCart();
        postToPayHere(checkoutUrl, params);
        return;
      }

      // B. Authenticated Customer Checkout Flow
      const order = await api.createOrder({
        items: orderPayloadItems,
        shippingAddress: {
          ...address,
          phone: resolvedPhone,
        },
      });

      if (method === 'cod') {
        await api.createCodPayment(order.id);
        clearCart();
        router.push(`/account/orders/${order.id}?success=true`);
        return;
      }

      if (method === 'installment') {
        await api.createInstallmentPayment(order.id, 3);
        clearCart();
        router.push(`/account/orders/${order.id}/installments?success=true`);
        return;
      }

      // PayHere Payment
      const { checkoutUrl, params } = await api.createPayherePayment(order.id);
      clearCart();
      postToPayHere(checkoutUrl, params);
    } catch (err: any) {
      if (err.code === 'VERIFICATION_REQUIRED' || err.code === 'CONTACT_UNVERIFIED') {
        setOtpModalOpen(true);
        handleSendOtp();
        return;
      }
      if (err.code === 'OTP_INVALID') {
        setOtpError('Invalid OTP code. Please enter the 6-digit verification code.');
        setOtpModalOpen(true);
        return;
      }
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const isAddressValid =
    address.fullName &&
    address.addressLine1 &&
    address.city &&
    address.state &&
    address.postalCode &&
    address.country &&
    (address.phone || phone) &&
    (isAuthenticated || email);

  const stepLabels = [
    { num: 1, label: 'Shipping & Contact' },
    { num: 2, label: 'Payment' },
    { num: 3, label: 'Review & Confirm' },
  ];

  const placeOrderLabel =
    method === 'cod'
      ? `Place Order — ${fmt(totalValue)}`
      : method === 'installment'
        ? `Start 3-Month Plan (1st Payment: ${fmt(totalValue / 3)})`
        : `Pay with PayHere — ${fmt(totalValue)}`;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
            Express Checkout
          </h1>
          <p style={{ color: 'var(--clr-text-2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Fast, secure checkout for Sri Lankan delivery
          </p>
        </div>

        {!isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', background: 'var(--clr-surface-2)', padding: '0.5rem 1rem', borderRadius: 'var(--r-md)' }}>
            <span>Already have an account?</span>
            <Link href="/login?returnTo=/checkout" className="btn btn-outline btn-sm">
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {stepLabels.map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '2rem', height: '2rem', borderRadius: '50%',
                background: step >= s.num ? 'var(--clr-brand)' : 'var(--clr-border)',
                color: step >= s.num ? 'white' : 'var(--clr-text-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.3s',
              }}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: step === s.num ? 600 : 400, color: step === s.num ? 'var(--clr-text)' : 'var(--clr-text-2)' }}>
              {s.label}
            </span>
            {i < 2 && <div className="w-6 sm:w-12" style={{ height: '2px', background: step > s.num ? 'var(--clr-brand)' : 'var(--clr-border)', margin: '0 0.5rem' }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div className="cart-layout">
        {/* Main Content */}
        <div>
          {/* STEP 1: Shipping Address & Contact */}
          {step === 1 && (
            <div className="card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📦</span> Shipping Address & Contact Info
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label htmlFor="checkout-name-input" className="input-label">Full Name *</label>
                  <input
                    id="checkout-name-input"
                    data-testid="checkout-name-input"
                    className="input"
                    name="fullName"
                    autoComplete="name"
                    value={address.fullName}
                    onChange={handleChange}
                    placeholder="e.g. Kasun Perera"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label htmlFor="checkout-email-input" className="input-label">Email Address *</label>
                    <input
                      id="checkout-email-input"
                      data-testid="checkout-email-input"
                      type="email"
                      className="input"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={isAuthenticated}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: '0.25rem', display: 'block' }}>
                      Invoice and tracking will be sent here
                    </span>
                  </div>

                  <div>
                    <label htmlFor="checkout-phone-input" className="input-label">Mobile Phone (Delivery Contact) *</label>
                    <input
                      id="checkout-phone-input"
                      data-testid="checkout-phone-input"
                      className="input"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={address.phone || phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setAddress({ ...address, phone: e.target.value });
                      }}
                      placeholder="077 123 4567"
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: '0.25rem', display: 'block' }}>
                      Rider will call this number for delivery
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="checkout-address1-input" className="input-label">Street Address Line 1 *</label>
                  <input
                    id="checkout-address1-input"
                    data-testid="checkout-address1-input"
                    className="input"
                    name="addressLine1"
                    autoComplete="address-line1"
                    value={address.addressLine1}
                    onChange={handleChange}
                    placeholder="House / Building No, Street Name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="checkout-address2-input" className="input-label">Address Line 2 (Optional)</label>
                  <input
                    id="checkout-address2-input"
                    data-testid="checkout-address2-input"
                    className="input"
                    name="addressLine2"
                    autoComplete="address-line2"
                    value={address.addressLine2}
                    onChange={handleChange}
                    placeholder="Apartment, suite, unit, etc."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="checkout-city-input" className="input-label">City *</label>
                    <input
                      id="checkout-city-input"
                      data-testid="checkout-city-input"
                      className="input"
                      name="city"
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={handleChange}
                      placeholder="Colombo / Kandy / Galle"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-state-input" className="input-label">Province / State *</label>
                    <input
                      id="checkout-state-input"
                      data-testid="checkout-state-input"
                      className="input"
                      name="state"
                      autoComplete="address-level1"
                      value={address.state}
                      onChange={handleChange}
                      placeholder="Western Province"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="checkout-postal-input" className="input-label">Postal Code *</label>
                    <input
                      id="checkout-postal-input"
                      data-testid="checkout-postal-input"
                      className="input"
                      name="postalCode"
                      autoComplete="postal-code"
                      value={address.postalCode}
                      onChange={handleChange}
                      placeholder="00300"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-country-input" className="input-label">Country *</label>
                    <input
                      id="checkout-country-input"
                      data-testid="checkout-country-input"
                      className="input"
                      name="country"
                      autoComplete="country-name"
                      value={address.country}
                      onChange={handleChange}
                      placeholder="Sri Lanka"
                      required
                    />
                  </div>
                </div>

                <button
                  data-testid="checkout-continue-to-payment-btn"
                  className="btn btn-primary btn-lg"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setStep(2)}
                  disabled={!isAddressValid}
                >
                  Continue to Payment →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment Method Selection */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Choose Payment Method</h2>

              <MethodCard
                testId="payment-method-payhere"
                selected={method === 'payhere'}
                onSelect={() => setMethod('payhere')}
                icon="💳"
                title="Card / Online Payment"
                subtitle="Visa, Mastercard, Frimi, Genie or Online Banking — Secured by PayHere"
                right={fmt(totalValue)}
                rightSub="Instant Checkout"
              />

              <MethodCard
                testId="payment-method-cod"
                selected={method === 'cod'}
                onSelect={() => setMethod('cod')}
                icon="💵"
                title="Cash on Delivery (COD)"
                subtitle="Pay in cash to the courier rider upon package delivery"
                right={fmt(totalValue)}
                rightSub="Verified Mobile"
              />

              <MethodCard
                testId="payment-method-installment"
                selected={method === 'installment'}
                onSelect={() => setMethod('installment')}
                icon="📅"
                title="Monthly Installments (3x Plan)"
                subtitle="Split into 3 equal monthly payments. Pay 1st installment today."
                right={`${fmt(totalValue / 3)} / mo`}
                rightSub="3 Monthly Payments"
              >
                {method === 'installment' && !isAuthenticated && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--clr-border)' }}>
                    <label className="input-label">Create Password for Installment Schedule *</label>
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a password (min 6 characters)"
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-3)', marginTop: '0.25rem', display: 'block' }}>
                      Required to access your account dashboard to view upcoming monthly payment schedules.
                    </span>
                  </div>
                )}
              </MethodCard>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn btn-outline btn-lg" onClick={() => setStep(1)}>← Back</button>
                <button data-testid="checkout-continue-to-review-btn" className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => setStep(3)}>
                  Continue to Review →
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
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Shipping & Contact Info</h3>
                  <button onClick={() => setStep(1)} className="btn btn-outline btn-sm">Edit</button>
                </div>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--clr-text-2)' }}>
                  <strong>{address.fullName}</strong><br />
                  📧 {email || user?.email}<br />
                  📱 {address.phone || phone}<br />
                  📍 {address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city}, {address.state} {address.postalCode}, {address.country}
                </p>
              </div>

              {/* Payment Method Review */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Payment Method</h3>
                  <button onClick={() => setStep(2)} className="btn btn-outline btn-sm">Change</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>
                    {method === 'payhere' ? '💳' : method === 'installment' ? '📅' : '💵'}
                  </span>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--clr-text)' }}>{methodLabel[method]}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>
                      {method === 'payhere' && <>Pay <strong>{fmt(totalValue)}</strong> securely via PayHere Gateway</>}
                      {method === 'cod' && <>Pay <strong>{fmt(totalValue)}</strong> in cash upon delivery</>}
                      {method === 'installment' && <>Pay 1st installment <strong>{fmt(totalValue / 3)}</strong> today</>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Review */}
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                  Order Items ({items.length} {items.length === 1 ? 'item' : 'items'})
                </h3>
                {items.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--clr-border)' }}>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{item.product.name}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)' }}>Qty: {item.quantity} × {fmt(Number(item.product.price))}</p>
                    </div>
                    <p style={{ fontWeight: 600 }}>{fmt(Number(item.product.price) * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-outline btn-lg" onClick={() => setStep(2)}>← Back</button>
                <button
                  data-testid="checkout-place-order-btn"
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1 }}
                  onClick={handlePlaceOrder}
                  disabled={loading}
                >
                  {loading ? 'Processing Order...' : placeOrderLabel}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div
          style={{
            background: 'var(--clr-surface)',
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--clr-border)',
            padding: '1.5rem',
            position: 'sticky',
            top: '6rem',
            height: 'fit-content',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Order Summary</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {items.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--clr-text-2)' }}>{item.product.name} × {item.quantity}</span>
                <span>{fmt(Number(item.product.price) * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--clr-text-2)' }}>Subtotal</span>
              <span>{fmt(totalValue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--clr-text-2)' }}>Islandwide Delivery</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>Free</span>
            </div>
          </div>

          <div style={{ borderTop: '2px solid var(--clr-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--clr-brand)' }}>
              {fmt(totalValue)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--clr-surface-2)', padding: '1rem', borderRadius: 'var(--r-md)', border: '1px solid var(--clr-border-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--clr-text)' }}>
              <ShieldCheck size={18} style={{ color: '#059669', flexShrink: 0 }} />
              <span>Bank-Grade 256-bit SSL Encryption</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--clr-text-3)', margin: 0, lineHeight: 1.4 }}>
              Payments processed securely via PayHere (Central Bank of Sri Lanka approved). Zero raw card details stored on our servers.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid var(--clr-border-2)', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>PayHere Verified</span>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid var(--clr-border-2)', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>Islandwide COD</span>
              <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', background: 'white', border: '1px solid var(--clr-border-2)', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>14-Day Exchange</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inline OTP Verification Modal (for COD / contact verification) */}
      {otpModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'var(--clr-brand-tint)', color: 'var(--clr-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>
              📱
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Verify Mobile for Cash on Delivery
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
              To prevent fake courier dispatches, enter the 6-digit OTP code sent to your contact.
            </p>

            {otpError && (
              <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem', borderRadius: '0.375rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                {otpError}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <input
                data-testid="checkout-otp-input"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{
                  width: '100%', fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center',
                  padding: '0.75rem', borderRadius: 'var(--r-md)', border: '2px solid var(--clr-brand)',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setOtpModalOpen(false)}>
                Cancel
              </button>
              <button
                data-testid="checkout-verify-confirm-btn"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handlePlaceOrder}
                disabled={otpCode.length < 6 || loading}
              >
                {loading ? 'Verifying...' : 'Verify & Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
