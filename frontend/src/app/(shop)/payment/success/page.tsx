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
    <div className="container" style={{ padding: '5rem 0', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
      {state === 'missing-order' && (
        <>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Missing order reference</h1>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
            This page needs an order to check on. If you just paid, check your orders list instead.
          </p>
          <Link href="/account/orders" className="btn btn-primary btn-lg">View my orders</Link>
        </>
      )}

      {state === 'polling' && (
        <>
          <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto 1.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Confirming your payment…</h1>
          <p style={{ color: 'var(--clr-text-2)' }}>
            PayHere is finalizing the transaction. This usually takes a few seconds — please don&apos;t close this page.
          </p>
        </>
      )}

      {state === 'completed' && (
        <>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#166534' }}>Payment confirmed!</h1>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
            Your order is confirmed and on its way into production.
          </p>
          <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg">View order</Link>
        </>
      )}

      {state === 'failed' && (
        <>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#991b1b' }}>Payment didn&apos;t go through</h1>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
            PayHere reported this payment as unsuccessful. Your order is still saved — you can try paying again from your orders page.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg">View order</Link>
            <Link href="/cart" className="btn btn-outline btn-lg">Back to cart</Link>
          </div>
        </>
      )}

      {state === 'timeout' && (
        <>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Still confirming</h1>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
            This is taking longer than usual. Your order is saved as pending — it will update automatically as soon as the payment provider confirms it. Check your orders page in a moment.
          </p>
          <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg">View order</Link>
        </>
      )}
    </div>
  );
}

// useSearchParams needs a Suspense boundary to keep the page static (same
// pattern as (auth)/login/page.tsx).
export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
