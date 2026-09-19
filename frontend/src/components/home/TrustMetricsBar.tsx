'use client';

import Link from 'next/link';
import Image from 'next/image';

const SERVICE_PILLARS = [
  { label: 'Island-Wide Delivery', note: 'Free on orders above Rs. 5,000 across all 25 districts' },
  { label: 'Express Showroom Pickup', note: 'Usually ready in 2–4 hours at Veyangoda & Kurunegala' },
  { label: '7-Day Hassle-Free Exchange', note: 'In-store or via nationwide courier collection' },
  { label: 'Flexible Payment Methods', note: 'Cards, Koko BNPL 3-Installments & Cash on Delivery' },
];

const SPOTLIGHT_DEPARTMENTS = [
  {
    id: 'women',
    tag: 'NEW SEASON DROP',
    title: "Women's Collection",
    subtitle: 'Sarees, Shalwars, Kurthis & Contemporary Workwear',
    image: '/images/categories/women.jpg',
    href: '/products?category=women',
    cta: 'Explore Collection',
  },
  {
    id: 'men',
    tag: 'MODERN ESSENTIALS',
    title: "Men's Wardrobe",
    subtitle: 'Formal Trousers, Linen Shirts & Pique Polos',
    image: '/images/categories/men.jpg',
    href: '/products?category=men',
    cta: 'Shop Essentials',
  },
  {
    id: 'uniforms',
    tag: 'ESTABLISHED 2009',
    title: 'School & Corporate Uniforms',
    subtitle: 'Government & Private Schools, Healthcare & Industrial Wear',
    image: '/images/categories/uniforms.jpg',
    href: '/products?category=uniforms',
    cta: 'View Uniform Solutions',
  },
];

export function TrustMetricsBar() {
  return (
    <section id="department-spotlight" aria-label="Featured Departments & Service Guarantees" className="w-full bg-white">
      {/* ── 1. Minimalist Editorial Service Ribbon (Thilakawardhana Style) ── */}
      <div className="border-b border-neutral-200/80 bg-neutral-50/70">
        <div className="container-wide py-3.5 sm:py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200/70">
            {SERVICE_PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                className={`flex flex-col sm:items-center text-left sm:text-center px-2 sm:px-4 ${
                  idx > 0 ? 'pt-2 sm:pt-0' : ''
                }`}
              >
                <span className="font-sans text-xs sm:text-[13px] font-bold text-neutral-900 tracking-tight">
                  {pillar.label}
                </span>
                <span className="font-mono text-[11px] text-neutral-500 mt-0.5">
                  {pillar.note}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Thilakawardhana-Style Curated Department Spotlight ── */}
      <div className="container-wide py-8 sm:py-12 border-b border-neutral-200/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {SPOTLIGHT_DEPARTMENTS.map((dept) => (
            <Link
              key={dept.id}
              href={dept.href}
              className="group relative block overflow-hidden rounded-xl bg-neutral-950 aspect-[4/3] sm:aspect-[4/5] shadow-sm hover:shadow-xl transition-all duration-300"
            >
              {/* Background Image with subtle zoom on hover */}
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={dept.image}
                  alt={dept.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 opacity-85 group-hover:opacity-95"
                />
              </div>

              {/* Sophisticated Editorial Vignette Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent transition-opacity duration-300" />

              {/* Content Overlay */}
              <div className="absolute inset-0 p-5 sm:p-7 flex flex-col justify-end text-white z-10">
                <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-[#CC0000] bg-white/95 px-2.5 py-1 rounded-sm w-fit mb-2.5 shadow-sm">
                  {dept.tag}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-neutral-100 transition-colors">
                  {dept.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 font-normal mt-1 mb-4 line-clamp-2 leading-relaxed">
                  {dept.subtitle}
                </p>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white group-hover:text-[#CC0000] transition-colors">
                  <span>{dept.cta}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform group-hover:translate-x-1"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
