'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { api } from '@/lib/api';
import { normalizeImageUrl } from '@/lib/image-url';
import type { Product } from '@/types';

/** The collection this curated look is drawn from. */
const LOOK_CATEGORY = 'corporate-uniforms';
const LOOK_SIZE = 3;

const rupees = (value: number) =>
  `Rs. ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "Shop the Look" — a curated outfit built from REAL catalogue products.
 *
 * It used to hard-code three products that did not exist ("look-1"…"look-3",
 * made-up prices and slugs): their links opened "Product Not Found", and
 * "Add Entire Look" put fake items in the cart that checkout then rejected.
 * It now shows in-stock products from the corporate collection, each linking to
 * its real page (where the customer picks a size or enters measurements for a
 * made-to-measure item), and hides itself entirely
 * when the collection has too few products to make a look.
 */
export function ShopTheLookSection() {
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getProducts({ categorySlug: LOOK_CATEGORY, limit: 12 })
      .then((res) => {
        if (!active) return;
        const usable = (res.products ?? []).filter((p) => p.stockQuantity > 0);
        setItems(usable.slice(0, LOOK_SIZE));
      })
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  // Nothing to show while loading, and nothing at all without a real look.
  if (!items || items.length < 2) return null;

  const totalPrice = items.reduce((sum, item) => sum + Number(item.price), 0);

  return (
    <section
      id="shop-the-look"
      aria-label="Shop the look"
      className="w-full py-14 sm:py-20 bg-white border-b border-neutral-200/70"
    >
      <div className="container-wide">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10 pb-3 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
              <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
              CURATED OUTFIT
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
              Shop the Look: Corporate Wear
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-lg">
              Coordinated pieces for the office and formal occasions — {items.length} pieces from{' '}
              {rupees(totalPrice)} in total.
            </p>
          </div>

          <div className="self-start sm:self-end">
            <Link href={`/products?category=${LOOK_CATEGORY}`} className="btn btn-brand btn-md shadow-md">
              Shop the Collection
            </Link>
          </div>
        </div>

        {/* Editorial Layout: Hero Visual on Left + Items on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden min-h-[380px] lg:min-h-full bg-neutral-900 shadow-md">
            <Image
              src="/images/hero/hero-banner-suits.png"
              alt="Corporate wear by Nandana Textile"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center filter saturate-105"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }}
            />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--gold-400)] block mb-1">
                {items.length}-PIECE LOOK
              </span>
              <h3 className="font-serif text-2xl font-bold text-white">Corporate Authority &amp; Classic Fit</h3>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            {items.map((item, idx) => (
              <Link
                key={item.id}
                href={`/products/${item.slug || item.id}`}
                className="group flex items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-xl border border-neutral-200/80 bg-[var(--warm-50)] hover:border-neutral-400 transition-all duration-200 no-underline"
              >
                <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-lg overflow-hidden bg-neutral-200 shrink-0 border border-neutral-200/70">
                  <Image
                    src={normalizeImageUrl(item.images?.[0])}
                    alt={item.name}
                    fill
                    sizes="100px"
                    className="object-cover object-center"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--clr-brand)] block mb-0.5">
                    PIECE {idx + 1}
                    {item.category?.name ? ` • ${item.category.name}` : ''}
                  </span>
                  <h4 className="font-sans text-sm sm:text-base font-bold text-neutral-900 leading-snug">{item.name}</h4>
                  <div className="text-sm sm:text-[0.9375rem] font-bold text-neutral-900 mt-1">{rupees(Number(item.price))}</div>
                  <div className="font-mono text-[0.65rem] text-neutral-500 mt-0.5">
                    {item.requiresMeasurement ? 'Made to your measurements' : 'In stock'}
                  </div>
                </div>

                <span className="shrink-0 btn btn-outline btn-sm hidden sm:inline-flex group-hover:border-neutral-900">
                  View Details
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
