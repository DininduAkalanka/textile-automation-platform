'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ShopError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface to error monitoring (e.g. Sentry) in production
    console.error('Shop route encountered an unhandled exception:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle size={32} />
        </div>

        <h1 className="font-display text-2xl font-bold text-neutral-900 mb-2">
          Unable to display this page
        </h1>

        <p className="text-sm text-neutral-600 mb-8 leading-relaxed">
          We encountered an unexpected issue while retrieving this catalogue section. Your cart and saved items remain completely safe.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--clr-brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 shadow-sm"
          >
            <RefreshCw size={15} />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Home size={15} />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
