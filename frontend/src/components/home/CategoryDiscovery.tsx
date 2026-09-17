'use client';

import Link from 'next/link';
import Image from 'next/image';

interface CategoryTile {
  id: string;
  name: string;
  subTitle: string;
  href: string;
  image: string;
  accent: string;
}

const CATEGORIES: CategoryTile[] = [
  {
    id: 'women',
    name: 'Women',
    subTitle: 'Sarees, Kurthas & Workwear',
    href: '/products?category=women',
    image: '/images/categories/women.jpg',
    accent: '#CC0000',
  },
  {
    id: 'men',
    name: 'Men',
    subTitle: 'Formal Shirts & Chinos',
    href: '/products?category=men',
    image: '/images/categories/men.jpg',
    accent: '#1d2e5a',
  },
  {
    id: 'teenagers',
    name: 'Teenagers',
    subTitle: 'Denim, Tees & Streetwear',
    href: '/products?category=teenagers',
    image: '/images/categories/teenagers.jpg',
    accent: '#0b7a8d',
  },
  {
    id: 'uniforms',
    name: 'Uniforms',
    subTitle: 'School, Corporate & Industrial',
    href: '/products?category=uniforms',
    image: '/images/categories/uniforms.jpg',
    accent: '#850000',
  },
  {
    id: 'fabrics',
    name: 'Fabrics',
    subTitle: 'Handloom, Cottons & Linens',
    href: '/products?category=fabrics',
    image: '/images/categories/fabrics.jpg',
    accent: '#928E82',
  },
];

export function CategoryDiscovery() {
  return (
    <section
      id="category-discovery"
      aria-label="Shop by Category"
      className="w-full py-12 sm:py-16 bg-[var(--warm-50)]"
    >
      <div className="container-wide">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 sm:mb-10 pb-3 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
              <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
              CURATED DEPARTMENTS
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
              Shop by Category
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--clr-brand)] hover:text-[var(--crimson-700)] transition-colors group"
          >
            <span>View All Departments</span>
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

        {/* 5-Column Editorial Grid on Desktop, 3 on Tablet, 2 on Mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
          {CATEGORIES.map((cat, idx) => (
            <Link
              key={cat.id}
              href={cat.href}
              id={`cat-card-${cat.id}`}
              className={`group relative flex flex-col rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                idx === 4 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              {/* Image Container with 3:4 Aspect Ratio */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-900">
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-106"
                />

                {/* Dark Vignette Overlay for High Readability */}
                <div
                  className="absolute inset-0 z-1 pointer-events-none transition-opacity duration-300"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.42) 50%, rgba(0,0,0,0.1) 100%)',
                  }}
                />

                {/* Content Overlay */}
                <div className="absolute inset-x-0 bottom-0 z-2 p-3.5 sm:p-4 text-white">
                  <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-wider text-neutral-300 block mb-0.5">
                    {cat.subTitle}
                  </span>
                  <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                    {cat.name}
                  </h3>
                  <div className="inline-flex items-center gap-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[#ff4d4d] mt-2 group-hover:gap-2 transition-all">
                    <span>Explore</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
