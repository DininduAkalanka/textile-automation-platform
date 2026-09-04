import Link from 'next/link';
import { Home, Compass, ShoppingBag, ArrowRight } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';

export default function GlobalNotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-20 bg-[var(--clr-surface)]">
      <div className="mx-auto max-w-lg text-center">
        {/* Brand identity */}
        <div className="mb-8 flex justify-center">
          <BrandMark size={48} variant="tile" />
        </div>

        <p className="text-xs font-mono font-bold uppercase tracking-[0.25em] text-[var(--clr-brand)] mb-2">
          Error 404
        </p>

        <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl mb-4">
          Page Not Found
        </h1>

        <p className="text-sm leading-relaxed text-neutral-600 mb-8 max-w-md mx-auto">
          The page you requested does not exist or may have moved. Explore our textile catalog or return to the main storefront.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--clr-brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Home size={16} />
            Return to Storefront
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 shadow-sm"
          >
            <Compass size={16} />
            Browse Products
          </Link>
        </div>

        {/* Category Shortcuts */}
        <div className="rounded-xl border border-neutral-200 bg-[var(--clr-surface-2)] p-6 text-left">
          <div className="flex items-center gap-2 mb-4 text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">
            <ShoppingBag size={14} className="text-[var(--clr-brand)]" />
            <span>Popular Destinations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              { label: 'School Uniforms', href: '/products?category=uniforms' },
              { label: 'Women’s Collection', href: '/products?category=women' },
              { label: 'Men’s Shirts & Wear', href: '/products?category=men' },
              { label: 'Track My Orders', href: '/account/orders' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-neutral-100 hover:border-[var(--clr-brand)] transition group"
              >
                <span className="text-neutral-800 font-medium text-xs">{link.label}</span>
                <ArrowRight size={13} className="text-neutral-400 group-hover:text-[var(--clr-brand)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
