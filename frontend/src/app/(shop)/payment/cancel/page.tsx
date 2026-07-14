'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Where PayHere's cancel_url sends the customer back to when they abort
 * checkout on PayHere's hosted page (doc 11 §6.2, plan Session 4.2 task 4).
 * No payment status is read or trusted here — PayHere never calls the
 * webhook for an aborted checkout, so the order simply stays PENDING and
 * the customer can retry. Before this page existed, cancel_url pointed at
 * a 404.
 */
function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="container" style={{ padding: '5rem 0', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
      <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛑</p>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Payment cancelled</h1>
      <p style={{ color: 'var(--clr-text-2)', marginBottom: '1.5rem' }}>
        You cancelled the payment before it completed. Nothing was charged, and your order is still saved — you can try again whenever you&apos;re ready.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        {orderId && (
          <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg">View order</Link>
        )}
        <Link href="/cart" className="btn btn-outline btn-lg">Back to cart</Link>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary to keep the page static (same
// pattern as (auth)/login/page.tsx and payment/success/page.tsx).
export default function PaymentCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      }
    >
      <PaymentCancelContent />
    </Suspense>
  );
}
