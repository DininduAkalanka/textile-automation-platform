'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';

export function NewArrivalsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getProducts({ limit: 12, sortBy: 'createdAt', sortOrder: 'desc' })
      .then((res) => {
        if (mounted) setProducts(res.products || []);
      })
      .catch((err) => console.error('Failed to fetch new arrivals:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section
      id="new-arrivals"
      aria-label="New Arrivals Merchandising"
      className="w-full py-14 sm:py-18 bg-white"
    >
      <div className="container-wide">
        {/* Header with Title & View All Link */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 sm:mb-10 pb-3 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
              <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
              JUST LANDED
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
              New Arrivals
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-lg">
              Fresh handcrafted sarees, executive shirting, breathable linens, and new season cuts.
            </p>
          </div>

          <Link
            href="/products?sort=newest"
            id="view-all-new-arrivals"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--clr-brand)] hover:text-[var(--crimson-700)] transition-colors group self-start sm:self-end"
          >
            <span>View All New In</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="ecommerce-product-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1800px]:grid-cols-6 gap-3.5 sm:gap-5 lg:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] w-full rounded-xl bg-neutral-100 animate-pulse border border-neutral-200/60"
              />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="ecommerce-product-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1800px]:grid-cols-6 gap-3.5 sm:gap-5 lg:gap-6">
            {products.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No new products found at this moment. Check back soon!
          </div>
        )}
      </div>
    </section>
  );
}
