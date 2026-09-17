'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/store/useCartStore';
import { useState } from 'react';

interface LookItem {
  id: string;
  name: string;
  price: number;
  image: string;
  slug: string;
  category: string;
}

const LOOK_ITEMS: LookItem[] = [
  {
    id: 'look-1',
    name: 'Executive Oxford Formal Shirt',
    price: 3450,
    image: '/images/products/men-shirt.png',
    slug: 'executive-oxford-formal-shirt',
    category: 'Men',
  },
  {
    id: 'look-2',
    name: 'Tailored Slim Fit Trousers',
    price: 4900,
    image: '/images/products/men-formal-trouser.jpg',
    slug: 'tailored-slim-fit-trousers',
    category: 'Men',
  },
  {
    id: 'look-3',
    name: 'Single-Breasted Suiting Blazer',
    price: 14500,
    image: '/images/products/uniform-blazer.png',
    slug: 'single-breasted-suiting-blazer',
    category: 'Uniforms',
  },
];

export function ShopTheLookSection() {
  const addItem = useCartStore((s) => s.addItem);
  const [addedAll, setAddedAll] = useState(false);

  const totalPrice = LOOK_ITEMS.reduce((sum, item) => sum + item.price, 0);

  const handleAddAll = () => {
    LOOK_ITEMS.forEach((item) => {
      // Mock minimal Product to pass to cart store
      addItem(
        {
          id: item.id,
          name: item.name,
          slug: item.slug,
          price: item.price,
          stockQuantity: 10,
          sku: `LOOK-${item.id}`,
          images: [item.image],
          attributes: { size: 'M', color: 'Classic' },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        1,
      );
    });
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 2500);
  };

  return (
    <section
      id="shop-the-look"
      aria-label="Shop the Look Fashion Merchandising"
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
              Shop the Look: The Executive Ensemble
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-lg">
              Coordinated tailoring engineered for boardrooms, official convocations, and executive events.
            </p>
          </div>

          <div className="self-start sm:self-end">
            <button
              onClick={handleAddAll}
              disabled={addedAll}
              className={`btn ${addedAll ? 'btn-brand bg-black' : 'btn-brand'} btn-md shadow-md`}
            >
              {addedAll ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>Added Complete Outfit!</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span>Add Entire Look — Rs. {totalPrice.toLocaleString('en-LK')}.00</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Editorial Layout: Hero Visual on Left + 3 Items on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Main Editorial Visual */}
          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden min-h-[380px] lg:min-h-full bg-neutral-900 shadow-md">
            <Image
              src="/images/hero/hero-banner-suits.png"
              alt="Executive Suiting Outfit by Nandana Textile"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center filter saturate-105"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--gold-400)] block mb-1">
                3-PIECE ENSEMBLE
              </span>
              <h3 className="font-serif text-2xl font-bold text-white">
                Corporate Authority &amp; Classic Fit
              </h3>
              <p className="text-xs text-neutral-300 mt-1 max-w-sm">
                Fine wool-blend suiting paired with breathable pinpoint cotton oxford shirting.
              </p>
            </div>
          </div>

          {/* Individual Look Items Grid */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            {LOOK_ITEMS.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-xl border border-neutral-200/80 bg-[var(--warm-50)] hover:border-neutral-300 transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-lg overflow-hidden bg-neutral-200 shrink-0 border border-neutral-200/70">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="100px"
                    className="object-cover object-center"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-[var(--clr-brand)] block mb-0.5">
                    PIECE {idx + 1} &bull; {item.category}
                  </span>
                  <h4 className="font-sans text-sm sm:text-base font-bold text-neutral-900 leading-snug">
                    {item.name}
                  </h4>
                  <div className="text-sm sm:text-[0.9375rem] font-bold text-neutral-900 mt-1">
                    Rs. {item.price.toLocaleString('en-LK')}.00
                  </div>
                  <div className="font-mono text-[0.65rem] text-neutral-500 mt-0.5">
                    In Stock &bull; Standard Sizing
                  </div>
                </div>

                {/* Quick Link */}
                <Link
                  href={`/products/${item.slug}`}
                  className="shrink-0 btn btn-outline btn-sm hidden sm:inline-flex"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
