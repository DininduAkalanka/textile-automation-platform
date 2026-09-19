'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';

export function NewArrivalsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

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

  const scroll = (direction: 'left' | 'right') => {
    if (!trackRef.current) return;
    const scrollAmount = trackRef.current.clientWidth * 0.75;
    trackRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!loading && products.length === 0) return null;

  return (
    <section
      id="new-arrivals"
      aria-label="New Arrivals Merchandising"
      className="w-full py-12 sm:py-16 bg-white"
    >
      <div className="container-wide">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
                <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
                JUST LANDED
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 uppercase">
                New Arrivals
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1">
                Fresh handcrafted sarees, executive shirting, breathable linens, and new season cuts.
              </p>
              <Link
                href="/products?sort=newest"
                id="view-all-new-arrivals"
                className="inline-block mt-2 text-xs font-semibold text-[#1e40af] hover:text-[#1d4ed8] underline underline-offset-4 tracking-wide transition-colors"
              >
                View All New In
              </Link>
            </div>

            {/* Arrow Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => scroll('left')}
                aria-label="Previous new arrivals"
                className="w-10 h-10 rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                aria-label="Next new arrivals"
                className="w-10 h-10 rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Track */}
        {loading ? (
          <div className="flex gap-3.5 sm:gap-5 lg:gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-[180px] sm:w-[230px] md:w-[260px] lg:w-[285px] 2xl:w-[315px] aspect-[3/4] rounded-xl bg-neutral-100 animate-pulse border border-neutral-200/60"
              />
            ))}
          </div>
        ) : (
          <div className="relative">
            <div
              ref={trackRef}
              className="flex gap-3.5 sm:gap-5 lg:gap-6 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {products.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex-none w-[180px] sm:w-[230px] md:w-[260px] lg:w-[285px] 2xl:w-[315px] snap-start"
                >
                  <ProductCard product={product} index={idx} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
