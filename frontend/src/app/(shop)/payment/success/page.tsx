'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type PollState = 'polling' | 'completed' | 'failed' | 'timeout' | 'missing-order';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 60000;

/**
 * Where PayHere's return_url actually sends the customer back to (doc 11
 * §6.2, plan Session 4.2 task 4). This page does NOT assume the redirect
 * itself means the payment succeeded — doc 11 §10.1's whole doctrine is
 * "never trust frontend payment status". The webhook is the only thing that
 * ever marks a payment COMPLETED; this page just polls for that to have
 * happened, the same GET /payments/:orderId the account order page reads.
 *
 * Before this page existed, PayHere was configured to redirect here and the
 * customer landed on a 404 instead of a confirmation screen.
 */
function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [state, setState] = useState<PollState>(orderId ? 'polling' : 'missing-order');
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!orderId) return;

    cancelledRef.current = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelledRef.current) return;

      try {
        const payment = await api.getPayment(orderId);
        if (cancelledRef.current) return;

        if (payment.status === 'COMPLETED') {
          setState('completed');
          return;
        }
        if (payment.status === 'FAILED') {
          setState('failed');
          return;
        }
        // PENDING (or REFUNDED, which shouldn't happen this soon) — keep polling.
      } catch {
        // A payment row briefly not resolving right after redirect isn't a
        // failure signal on its own — keep polling until the timeout.
      }

      if (Date.now() - startedAt >= MAX_POLL_MS) {
        setState('timeout');
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelledRef.current = true;
    };
  }, [orderId]);

  return (
    <div className="container" style={{ paddingTop: '3.5rem', paddingBottom: '5rem', maxWidth: '540px', margin: '0 auto' }}>
      <div className="card p-6 sm:p-10 text-center shadow-lg border border-[var(--clr-border)] rounded-2xl bg-[var(--clr-surface)]">
        {state === 'missing-order' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200">
              ⚠️
            </div>
            <h1 className="font-display text-2xl font-bold mb-2 text-[var(--clr-text)]">Missing Order Reference</h1>
            <p className="text-sm text-[var(--clr-text-2)] mb-6 leading-relaxed">
              This page requires an order reference. If you just completed a payment, check your orders dashboard.
            </p>
            <Link href="/account/orders" className="btn btn-primary btn-lg w-full" style={{ minHeight: '48px' }}>
              View My Orders
            </Link>
          </>
        )}

        {state === 'polling' && (
          <>
            <div className="skeleton w-16 h-16 rounded-full mx-auto mb-5" />
            <h1 className="font-display text-2xl font-bold mb-2 text-[var(--clr-text)]">Verifying Your Payment…</h1>
            <p className="text-sm text-[var(--clr-text-2)] leading-relaxed">
              PayHere is finalizing the transaction with your banking provider. This usually takes just a few moments — please don&apos;t close this page.
            </p>
          </>
        )}

        {state === 'completed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-200 shadow-sm">
              ✓
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full inline-block mb-3">
              Payment Confirmed
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-neutral-900">
              Thank You For Your Order!
            </h1>
            <p className="text-sm text-[var(--clr-text-2)] mb-6 leading-relaxed">
              Your order has been confirmed and routed directly to our production floor. A confirmation SMS and email have been dispatched.
            </p>

            {orderId && (
              <div className="bg-[var(--clr-surface-2)] p-4 rounded-xl border border-[var(--clr-border)] mb-6 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--clr-text-3)] font-mono uppercase tracking-wider">Order Reference</span>
                  <span className="font-mono font-bold text-[var(--clr-text)] truncate max-w-[200px]">{orderId}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-[var(--clr-border-2)] pt-2">
                  <span className="text-[var(--clr-text-3)]">Estimated Delivery</span>
                  <span className="font-semibold text-emerald-700">2–4 Business Days</span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {orderId && (
                <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg flex-1" style={{ minHeight: '48px' }}>
                  Track Order Status →
                </Link>
              )}
              <Link href="/products" className="btn btn-outline btn-lg flex-1" style={{ minHeight: '48px' }}>
                Continue Shopping
              </Link>
            </div>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-rose-200">
              ✕
            </div>
            <h1 className="font-display text-2xl font-bold mb-2 text-rose-900">Payment Unsuccessful</h1>
            <p className="text-sm text-[var(--clr-text-2)] mb-6 leading-relaxed">
              PayHere reported this transaction as incomplete or declined by your bank. Your cart and order items are securely preserved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {orderId && (
                <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg flex-1" style={{ minHeight: '48px' }}>
                  Retry Payment
                </Link>
              )}
              <Link href="/cart" className="btn btn-outline btn-lg flex-1" style={{ minHeight: '48px' }}>
                Back to Cart
              </Link>
            </div>
          </>
        )}

        {state === 'timeout' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200">
              ⏳
            </div>
            <h1 className="font-display text-2xl font-bold mb-2 text-amber-900">Confirmation In Progress</h1>
            <p className="text-sm text-[var(--clr-text-2)] mb-6 leading-relaxed">
              Your bank transaction is taking a bit longer to post. Your order is safely saved as pending and will update automatically once verified.
            </p>
            <Link href={orderId ? `/account/orders/${orderId}` : '/account/orders'} className="btn btn-primary btn-lg w-full" style={{ minHeight: '48px' }}>
              Check Orders Dashboard →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary to keep the page static (same
// pattern as (auth)/login/page.tsx).
export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
