'use client';

import { useRef } from 'react';
import type { Product } from '@/types';
import ProductCard from './ProductCard';

interface Props {
  title: string;
  subtitle?: string;
  products: Product[];
}

/**
 * A horizontal, scroll-snapping product carousel with desktop arrow controls —
 * used for "Customers Also Bought" and "Recently Viewed" on the product page.
 * Renders nothing when empty, so callers can drop it in unconditionally.
 */
export function ProductRail({ title, subtitle, products }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!products.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <section style={section}>
      <div style={head}>
        <div>
          <div style={eyebrow}>
            <span style={eyebrowRule} />
            {subtitle ?? 'CURATED FOR YOU'}
          </div>
          <h2 style={heading}>{title}</h2>
        </div>
        <div style={arrows} className="rail-arrows">
          <button aria-label="Scroll left" onClick={() => scrollBy(-1)} style={arrowBtn}>
            ‹
          </button>
          <button aria-label="Scroll right" onClick={() => scrollBy(1)} style={arrowBtn}>
            ›
          </button>
        </div>
      </div>

      <div ref={trackRef} style={track} className="product-rail-track">
        {products.map((p, i) => (
          <div key={p.id} style={item} className="product-rail-item">
            <ProductCard product={p} index={i} />
          </div>
        ))}
      </div>

      {/* Hide the scrollbar chrome; keep it scrollable/keyboard-accessible. */}
      <style>{`
        .product-rail-track::-webkit-scrollbar { display: none; }
        .rail-arrows { display: none; }
        @media (min-width: 768px) { .rail-arrows { display: flex; } }
      `}</style>
    </section>
  );
}

const section = { margin: '3.5rem 0 0' };

const head = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '1rem',
  marginBottom: '1.5rem',
};

const eyebrow = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.16em',
  color: 'var(--clr-brand, #CC0000)',
  marginBottom: '0.35rem',
};

const eyebrowRule = {
  display: 'inline-block',
  width: '26px',
  height: '2px',
  background: 'var(--clr-brand, #CC0000)',
};

const heading = {
  fontSize: 'clamp(1.25rem, 2.4vw, 1.6rem)',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--clr-text, #141414)',
  margin: 0,
};

const arrows = { gap: '0.5rem' } as const;

const arrowBtn = {
  width: '2.5rem',
  height: '2.5rem',
  borderRadius: '999px',
  border: '1.5px solid var(--color-border, #e4e1da)',
  background: '#fff',
  color: 'var(--clr-text, #141414)',
  fontSize: '1.35rem',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingBottom: '2px',
};

const track = {
  display: 'flex',
  gap: '1.25rem',
  overflowX: 'auto' as const,
  scrollSnapType: 'x mandatory' as const,
  scrollbarWidth: 'none' as const,
  paddingBottom: '0.5rem',
  scrollPadding: '0 1rem',
};

const item = {
  flex: '0 0 auto',
  width: 'clamp(200px, 44vw, 260px)',
  scrollSnapAlign: 'start' as const,
};
