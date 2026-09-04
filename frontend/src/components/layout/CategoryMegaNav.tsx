'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { useCategories } from '@/hooks/use-categories';

/* ── Types ────────────────────────────────────────────────── */
export interface SubCategoryLink {
  label: string;
  href: string;
  note?: string;
}

export interface MegaColumn {
  title: string;
  viewAllHref?: string;
  links: SubCategoryLink[];
}

export interface PromoCard {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  ctaText?: string;
}

export interface CategoryItem {
  id: string;
  label: string;
  href: string;
  thumbnail?: string;
  badge?: string;
  columns?: MegaColumn[];
  promoCard?: PromoCard;
}

/* ── Exact Existing Categories (Fashion Bug Style Taxonomy) ── */
export const CATEGORIES_DATA: CategoryItem[] = [
  {
    id: 'home',
    label: 'HOME',
    href: '/',
    thumbnail: '/icon-512.png',
  },
  {
    id: 'new-arrivals',
    label: 'NEW ARRIVALS',
    href: '/products?category=new-arrivals',
    thumbnail: '/images/hero1.png',
    columns: [
      {
        title: 'WOMEN NEW ARRIVALS',
        viewAllHref: '/products?category=women&sort=newest',
        links: [
          { label: 'Latest This Week', href: '/products?category=new-arrivals&sub=latest-this-week' },
          { label: 'Trending Now', href: '/products?category=new-arrivals&sub=trending-now' },
          { label: 'Premium Collection', href: '/products?category=new-arrivals&sub=premium-collection' },
          { label: 'Special Offers', href: '/products?category=new-arrivals&sub=special-offers' },
        ],
      },
      {
        title: 'MEN & TEENS NEW IN',
        viewAllHref: '/products?category=men&sort=newest',
        links: [
          { label: 'Executive Formal Shirts', href: '/products?category=men&sub=shirts' },
          { label: 'Casual Linen Shirts', href: '/products?category=men&sub=casual' },
          { label: 'Trendy Street Style', href: '/products?category=teenagers&sub=street' },
          { label: 'Activewear & Sportswear', href: '/products?category=teenagers&sub=sports' },
        ],
      },
      {
        title: 'UNIFORM HIGHLIGHTS',
        viewAllHref: '/products?category=uniforms&sort=newest',
        links: [
          { label: 'Government School Uniforms', href: '/products?category=uniforms&sub=government-school' },
          { label: 'Private School Uniforms', href: '/products?category=uniforms&sub=private-school' },
          { label: 'Corporate Office Uniforms', href: '/products?category=uniforms&sub=corporate' },
        ],
      },
    ],
    promoCard: {
      title: 'New Arrivals 2026',
      subtitle: 'Explore the freshest fabrics and ready-to-wear seasonal trends',
      image: '/images/hero1.png',
      href: '/products?category=new-arrivals',
      ctaText: 'Shop New In',
    },
  },
  {
    id: 'women',
    label: 'WOMEN',
    href: '/products?category=women',
    thumbnail: '/images/categories/women.jpg',
    columns: [
      {
        title: 'SAREES & ETHNIC',
        viewAllHref: '/products?category=women&sub=sarees',
        links: [
          { label: 'Traditional Silk Sarees', href: '/products?category=women&sub=sarees' },
          { label: 'Cotton Sarees', href: '/products?category=women&sub=sarees' },
          { label: 'Designer Kurthas', href: '/products?category=women&sub=kurthas' },
          { label: 'Stitched Blouses', href: '/products?category=women&sub=blouses' },
        ],
      },
      {
        title: 'READY-TO-WEAR',
        viewAllHref: '/products?category=women&sub=casual',
        links: [
          { label: 'Evening Wear', href: '/products?category=women&sub=evening' },
          { label: 'Casual Wear', href: '/products?category=women&sub=casual' },
          { label: 'Office Wear', href: '/products?category=women&sub=casual' },
        ],
      },
      {
        title: 'FABRIC MATERIALS',
        viewAllHref: '/products?category=women&sub=dress-materials',
        links: [
          { label: 'Dress Materials', href: '/products?category=women&sub=dress-materials' },
          { label: 'Cotton Voile Cuts', href: '/products?category=women&sub=dress-materials' },
          { label: 'Linen Blends', href: '/products?category=women&sub=dress-materials' },
        ],
      },
    ],
    promoCard: {
      title: 'Women’s Collection',
      subtitle: 'Handcrafted sarees, stylish kurthas & fine dress materials',
      image: '/images/categories/women.jpg',
      href: '/products?category=women',
      ctaText: 'Shop Women',
    },
  },
  {
    id: 'men',
    label: 'MEN',
    href: '/products?category=men',
    thumbnail: '/images/categories/men.jpg',
    columns: [
      {
        title: 'FORMAL WEAR',
        viewAllHref: '/products?category=men&sub=shirts',
        links: [
          { label: 'Formal Shirts', href: '/products?category=men&sub=shirts' },
          { label: 'Tailored Trousers', href: '/products?category=men&sub=trousers' },
          { label: 'Office Executive Suits', href: '/products?category=men&sub=shirts' },
        ],
      },
      {
        title: 'TRADITIONAL & CASUAL',
        viewAllHref: '/products?category=men&sub=sarongs',
        links: [
          { label: 'Handloom Sarongs', href: '/products?category=men&sub=sarongs' },
          { label: 'Casual Wear', href: '/products?category=men&sub=casual' },
          { label: 'Sports & Active', href: '/products?category=men&sub=sports' },
        ],
      },
    ],
    promoCard: {
      title: 'Men’s Collection',
      subtitle: 'Sharp formal shirts, handloom sarongs & comfortable casuals',
      image: '/images/categories/men.jpg',
      href: '/products?category=men',
      ctaText: 'Shop Men',
    },
  },
  {
    id: 'teenagers',
    label: 'TEENAGERS',
    href: '/products?category=teenagers',
    thumbnail: '/images/categories/teenagers.jpg',
    columns: [
      {
        title: 'CASUAL & TRENDY',
        viewAllHref: '/products?category=teenagers&sub=casual',
        links: [
          { label: 'Casual & Trendy', href: '/products?category=teenagers&sub=casual' },
          { label: 'Street Style', href: '/products?category=teenagers&sub=street' },
        ],
      },
      {
        title: 'SPORTS & SCHOOL',
        viewAllHref: '/products?category=teenagers&sub=sports',
        links: [
          { label: 'Sportswear', href: '/products?category=teenagers&sub=sports' },
          { label: 'School Ready', href: '/products?category=teenagers&sub=school-ready' },
        ],
      },
    ],
    promoCard: {
      title: 'Teenagers Collection',
      subtitle: 'Fresh youth styles, energetic streetwear & schoolwear',
      image: '/images/categories/teenagers.jpg',
      href: '/products?category=teenagers',
      ctaText: 'Shop Teenagers',
    },
  },
  {
    id: 'uniforms',
    label: 'UNIFORMS',
    href: '/products?category=uniforms',
    thumbnail: '/images/categories/uniforms.jpg',
    badge: 'BESPOKE',
    columns: [
      {
        title: 'SCHOOL UNIFORMS',
        viewAllHref: '/products?category=uniforms&sub=school-all',
        links: [
          { label: 'Government School Uniforms', href: '/products?category=uniforms&sub=government-school', note: 'Standard approved' },
          { label: 'Private School Uniforms', href: '/products?category=uniforms&sub=private-school', note: 'Premium quality' },
        ],
      },
      {
        title: 'OFFICE & WORKWEAR',
        viewAllHref: '/products?category=uniforms&sub=office-all',
        links: [
          { label: 'Corporate Formal Wear', href: '/products?category=uniforms&sub=corporate', note: 'Professional attire' },
          { label: 'Workwear & Industrial', href: '/products?category=uniforms&sub=industrial', note: 'Durable fabrics' },
          { label: 'Healthcare Uniforms', href: '/products?category=uniforms&sub=healthcare', note: 'Medical & clinic' },
        ],
      },
    ],
    promoCard: {
      title: 'Uniforms & Made-to-Measure',
      subtitle: 'Government approved uniform standards & bespoke custom tailoring',
      image: '/images/categories/uniforms.jpg',
      href: '/products?category=uniforms',
      ctaText: 'View Uniforms',
    },
  },
];

/* ── Fashion Bug Style Category Navigation Bar Component ──── */
export function CategoryMegaNav() {
  const { data: dbCategories } = useCategories();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dynamically merge DB categories with rich template mega-menu structures
  const categories = useMemo(() => {
    // Fixed initial items
    const navItems: CategoryItem[] = [
      CATEGORIES_DATA[0], // HOME
      CATEGORIES_DATA[1], // NEW ARRIVALS
    ];

    if (dbCategories && dbCategories.length > 0) {
      // Find top-level categories (parentId is null or empty)
      const topLevel = dbCategories.filter((c) => !c.parentId);

      topLevel.forEach((cat) => {
        const catSlug = (cat.slug || cat.name).toLowerCase();
        // Match existing rich template if available (e.g. women, men, teenagers, uniforms)
        const template = CATEGORIES_DATA.find(
          (t) =>
            t.id.toLowerCase() === catSlug ||
            t.label.toLowerCase() === cat.name.toLowerCase(),
        );

        if (template) {
          navItems.push({
            ...template,
            id: cat.slug || template.id,
            label: cat.name.toUpperCase(),
            href: `/products?category=${encodeURIComponent(cat.slug || cat.id)}`,
          });
        } else {
          // Dynamic category created in Admin panel (e.g. "School")!
          const children = dbCategories.filter((c) => c.parentId === cat.id);
          navItems.push({
            id: cat.slug || cat.id,
            label: cat.name.toUpperCase(),
            href: `/products?category=${encodeURIComponent(cat.slug || cat.id)}`,
            thumbnail: cat.imageUrl || undefined,
            columns:
              children.length > 0
                ? [
                    {
                      title: cat.name.toUpperCase(),
                      viewAllHref: `/products?category=${encodeURIComponent(cat.slug || cat.id)}`,
                      links: children.map((sub) => ({
                        label: sub.name,
                        href: `/products?category=${encodeURIComponent(sub.slug || sub.id)}`,
                      })),
                    },
                  ]
                : undefined,
          });
        }
      });

      return navItems;
    }

    return CATEGORIES_DATA;
  }, [dbCategories]);

  const activeCategory = categories.find((c) => c.id === activeId);

  return (
    <div
      className="relative z-40 w-full select-none"
      onMouseLeave={() => setActiveId(null)}
      style={{
        background: '#CC0000',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* ── Signature Red Category Navigation Bar (Responsive & Dynamic) ── */}
      <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
        <nav
          className="flex items-center justify-start gap-0.5 sm:gap-1 lg:gap-2 overflow-x-auto no-scrollbar py-0.5"
          aria-label="Main Store Categories"
        >
          {categories.map((cat) => {
            const isActive = activeId === cat.id;
            const hasMenu = Boolean(cat.columns && cat.columns.length > 0);

            return (
              <div
                key={cat.id}
                className="relative shrink-0"
                onMouseEnter={() => (hasMenu ? setActiveId(cat.id) : setActiveId(null))}
              >
                <Link
                  href={cat.href}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-3 text-xs lg:text-[0.8125rem] font-bold uppercase tracking-wider transition-all duration-150 ${
                    isActive
                      ? 'text-white bg-black/15'
                      : 'text-white hover:text-white hover:bg-white/10'
                  }`}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span>{cat.label}</span>

                  {/* Fashion Bug Style Active White Underline Indicator */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-white rounded-t-sm"
                      style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.15)' }}
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Fashion Bug Style Full-Width Mega-Menu Panel Dropdown ── */}
      {activeCategory && activeCategory.columns && (
        <div
          className="absolute left-0 right-0 top-full w-full bg-white text-neutral-900 border-b border-neutral-200 shadow-2xl z-50"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInMega 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
          onMouseEnter={() => setActiveId(activeCategory.id)}
          onMouseLeave={() => setActiveId(null)}
        >
          <div className="mx-auto max-w-7xl px-6 py-7">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Category Columns */}
              <div
                className={`grid gap-8 ${
                  activeCategory.columns.length >= 3
                    ? 'md:col-span-8 lg:col-span-9 grid-cols-2 lg:grid-cols-3'
                    : 'md:col-span-8 lg:col-span-8 grid-cols-2'
                }`}
              >
                {activeCategory.columns.map((col, idx) => (
                  <div key={idx} className="space-y-3">
                    {/* Column Header (Fashion Bug uppercase bold header) */}
                    <div className="pb-1.5 border-b border-neutral-200">
                      <h4 className="text-[0.8125rem] font-black uppercase tracking-wider text-neutral-900 font-sans">
                        {col.title}
                      </h4>
                    </div>

                    {/* Subcategory Links list */}
                    <ul className="space-y-2 pt-1">
                      {col.links.map((link, lIdx) => (
                        <li key={lIdx}>
                          <Link
                            href={link.href}
                            onClick={() => setActiveId(null)}
                            className="group flex flex-col text-[0.8125rem] text-neutral-600 hover:text-[#CC0000] transition-colors py-0.5"
                          >
                            <span className="transition-transform duration-150 group-hover:translate-x-1 font-medium group-hover:font-semibold">
                              {link.label}
                            </span>
                            {link.note && (
                              <span className="text-[0.675rem] text-neutral-400 font-mono tracking-tight">
                                {link.note}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>

                    {/* View All */}
                    {col.viewAllHref && (
                      <div className="pt-2">
                        <Link
                          href={col.viewAllHref}
                          onClick={() => setActiveId(null)}
                          className="inline-flex items-center gap-1 text-[0.725rem] font-bold uppercase tracking-wider text-[#CC0000] hover:text-[#990000] transition-colors"
                        >
                          <span>View All</span>
                          <span>→</span>
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right-Hand Visual Promo Card (Just like Fashion Bug) */}
              {activeCategory.promoCard && (
                <div
                  className={`hidden md:block ${
                    activeCategory.columns.length >= 3
                      ? 'md:col-span-4 lg:col-span-3'
                      : 'md:col-span-4 lg:col-span-4'
                  }`}
                >
                  <Link
                    href={activeCategory.promoCard.href}
                    onClick={() => setActiveId(null)}
                    className="group relative block overflow-hidden rounded-xl bg-neutral-900 shadow-md transition-all duration-300 hover:shadow-xl"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden">
                      <Image
                        src={activeCategory.promoCard.image}
                        alt={activeCategory.promoCard.title}
                        fill
                        sizes="(max-width: 1024px) 280px, 320px"
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Gradient Scrim */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                      {/* Card Content at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h5 className="font-serif text-sm font-bold leading-tight text-white group-hover:text-amber-300 transition-colors">
                          {activeCategory.promoCard.title}
                        </h5>
                        <p className="mt-1 text-[0.7rem] text-neutral-300 line-clamp-2 leading-relaxed">
                          {activeCategory.promoCard.subtitle}
                        </p>
                        <div className="mt-2.5 inline-flex items-center gap-1 text-[0.725rem] font-bold text-white uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                          <span>{activeCategory.promoCard.ctaText || 'Shop Now'}</span>
                          <span>→</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
