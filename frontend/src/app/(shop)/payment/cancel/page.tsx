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
    <div className="container" style={{ paddingTop: '3.5rem', paddingBottom: '5rem', maxWidth: '520px', margin: '0 auto' }}>
      <div className="card p-6 sm:p-10 text-center shadow-lg border border-[var(--clr-border)] rounded-2xl bg-[var(--clr-surface)]">
        <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-neutral-200">
          🛑
        </div>
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full inline-block mb-3">
          Transaction Cancelled
        </span>
        <h1 className="font-display text-2xl font-bold mb-2 text-neutral-900">Payment Was Cancelled</h1>
        <p className="text-sm text-[var(--clr-text-2)] mb-6 leading-relaxed">
          You cancelled the transaction before it completed. Your card has not been charged, and your items are preserved. You can resume checkout whenever you&apos;re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {orderId && (
            <Link href={`/account/orders/${orderId}`} className="btn btn-primary btn-lg flex-1" style={{ minHeight: '48px' }}>
              Resume Order →
            </Link>
          )}
          <Link href="/cart" className="btn btn-outline btn-lg flex-1" style={{ minHeight: '48px' }}>
            Back to Cart
          </Link>
        </div>
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
        <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      }
    >
      <PaymentCancelContent />
    </Suspense>
  );
}
