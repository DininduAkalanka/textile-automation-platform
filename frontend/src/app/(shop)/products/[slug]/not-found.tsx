import Link from 'next/link';
import { ArrowLeft, PackageX, Sparkles } from 'lucide-react';

export default function ProductNotFound() {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <div className="mx-auto max-w-md">
        {/* Visual Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <PackageX size={36} strokeWidth={1.5} />
        </div>

        <span className="inline-block rounded-full bg-[var(--clr-surface-2)] px-3 py-1 text-xs font-mono font-semibold uppercase tracking-widest text-[var(--clr-brand)] mb-3">
          Catalogue Notice
        </span>

        <h1 className="font-display text-2xl font-bold text-neutral-900 sm:text-3xl mb-3">
          This textile or garment is unavailable
        </h1>

        <p className="text-sm leading-relaxed text-neutral-600 mb-8">
          The item you are looking for may have sold out, retired from our current season, or moved to a different collection.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center mb-10">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--clr-brand)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Sparkles size={16} />
            Explore All Collections
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <ArrowLeft size={16} />
            Back to Homepage
          </Link>
        </div>

        {/* Quick Category Discovery */}
        <div className="border-t border-neutral-200 pt-8">
          <p className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-4">
            Popular Categories
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'School Uniforms', href: '/products?category=uniforms' },
              { label: 'Women’s Sarees', href: '/products?category=women&sub=sarees' },
              { label: 'Men’s Formal Wear', href: '/products?category=men&sub=shirts' },
              { label: 'Dress Materials', href: '/products?category=women&sub=dress-materials' },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-xs text-neutral-700 transition hover:border-neutral-400 hover:bg-white"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
