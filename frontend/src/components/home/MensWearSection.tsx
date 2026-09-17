'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';

export function MensWearSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getProducts({ categorySlug: 'men', limit: 8 })
      .then((res) => {
        if (mounted) {
          setProducts(res.products || []);
        }
      })
      .catch((err) => console.error('Failed to fetch men wear products:', err))
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
      id="mens-wear"
      aria-label="Men's Wear Collection"
      className="w-full py-12 sm:py-16 bg-white border-b border-neutral-100"
    >
      <div className="container-wide">
        {/* Thilakawardhana-style Editorial Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 uppercase">
                Men&apos;s Wear
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1">
                Upgrade your wardrobe with our newest men&apos;s fashion. Shop stylish and modern pieces today!
              </p>
              <Link
                href="/products?category=men"
                className="inline-block mt-2 text-xs font-semibold text-[#1e40af] hover:text-[#1d4ed8] underline underline-offset-4 tracking-wide transition-colors"
              >
                View All
              </Link>
            </div>

            {/* Top Right Corner Swaps Arrows */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scroll('left')}
                aria-label="Previous men's wear products"
                className="w-10 h-10 rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                aria-label="Next men's wear products"
                className="w-10 h-10 rounded-full border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Carousel / Product Track */}
        {loading ? (
          <div className="ecommerce-product-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] w-full rounded-xl bg-neutral-200/60 animate-pulse"
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
