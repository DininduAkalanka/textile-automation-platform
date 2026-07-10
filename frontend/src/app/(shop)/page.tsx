'use client';

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';

/* ── Icons ──────────────────────────────────────────────────── */
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

/* ── Data ────────────────────────────────────────────────────── */
const HERO_SLIDES = [
  {
    id: 1,
    eyebrow: 'New Season 2024',
    headline: 'Curated Textiles for Every Occasion',
    subheadline: 'School, office, and fashion — precision-crafted fabrics with over 15 years of expertise in Sri Lanka.',
    primaryCta:   { label: 'Shop New Arrivals',  href: '/products?sort=newest' },
    secondaryCta: { label: 'Explore Categories', href: '/products' },
    accentColor: 'var(--crimson-600)',
    image: '/images/hero1.png',
  },
  {
    id: 2,
    eyebrow: 'Uniform Specialists',
    headline: 'School & Office Uniforms, Precisely Tailored',
    subheadline: 'Government and private school uniforms, corporate formal wear — uniform-grade fabrics trusted by institutions across Sri Lanka.',
    primaryCta:   { label: 'View Uniform Collection', href: '/products?category=uniforms' },
    secondaryCta: { label: 'Request Bulk Order',       href: '/products?category=uniforms&bulk=1' },
    accentColor: 'var(--gold-500)',
    image: '/images/hero2.png',
  },
  {
    id: 3,
    eyebrow: "Women's Collection",
    headline: 'Sarees, Dress Materials & Kurthas',
    subheadline: 'From traditional sarees to contemporary dress materials — discover the finest women\'s fabrics, curated for every celebration.',
    primaryCta:   { label: "Shop Women's Collection", href: '/products?category=women' },
    secondaryCta: { label: 'View Sarees',              href: '/products?category=women&sub=sarees' },
    accentColor: 'var(--crimson-600)',
    image: '/images/hero3.png',
  },
];

const CATEGORIES = [
  { id: 'new-arrivals', label: 'New Arrivals',  subLabel: 'This Season',     href: '/products?sort=newest',          bg: 'linear-gradient(160deg, #0d0d0d 0%, #1f0000 100%)' },
  { id: 'women',        label: 'Women',          subLabel: 'Sarees & More',   href: '/products?category=women',       bg: 'linear-gradient(160deg, #0d0005 0%, #1f0015 100%)' },
  { id: 'men',          label: 'Men',            subLabel: 'Formal & Casual', href: '/products?category=men',         bg: 'linear-gradient(160deg, #000a0d 0%, #00151f 100%)' },
  { id: 'teenagers',    label: 'Teenagers',      subLabel: 'Trending',        href: '/products?category=teenagers',   bg: 'linear-gradient(160deg, #050d00 0%, #0f1f00 100%)' },
  { id: 'uniforms',     label: 'Uniforms',       subLabel: 'School & Office', href: '/products?category=uniforms',   bg: 'linear-gradient(160deg, #0d0500 0%, #1f0f00 100%)' },
];

const UNIFORM_SEGMENTS = [
  {
    id: 'government-school',
    label: 'Government School Uniforms',
    description: 'Standard-approved, durable uniforms meeting all government specifications for primary and secondary schools.',
    badge: 'Most Ordered',
    href: '/products?category=uniforms&sub=government-school',
    bg: 'linear-gradient(155deg, #080808 0%, #1a0000 100%)',
  },
  {
    id: 'private-school',
    label: 'Private School Uniforms',
    description: 'Premium-grade fabrics crafted to the exact specifications of leading private schools across Sri Lanka.',
    badge: 'Premium',
    href: '/products?category=uniforms&sub=private-school',
    bg: 'linear-gradient(155deg, #0a0000 0%, #280000 100%)',
  },
  {
    id: 'corporate',
    label: 'Corporate Office Uniforms',
    description: 'Polished, professional formal wear for corporate environments — tailored for comfort across long working hours.',
    badge: '',
    href: '/products?category=uniforms&sub=corporate',
    bg: 'linear-gradient(155deg, #00080d 0%, #00141f 100%)',
  },
  {
    id: 'industrial',
    label: 'Workwear & Industrial',
    description: 'Heavy-duty fabrics engineered for industrial and workwear applications — built to last in demanding conditions.',
    badge: '',
    href: '/products?category=uniforms&sub=industrial',
    bg: 'linear-gradient(155deg, #060600 0%, #141400 100%)',
  },
];

const MARQUEE_ITEMS = [
  'Free Delivery on Orders above Rs. 5,000',
  'Government School Uniforms Available',
  'Private School Uniform Specialists',
  'Corporate & Office Uniform Orders',
  'Women\'s Saree Collection — New Season',
  'Island-Wide Delivery across Sri Lanka',
  'Bulk Orders Welcome',
  '15+ Years of Textile Excellence',
];

const TRUST_ITEMS = [
  { id: 'delivery', iconPath: 'M5 12h14M12 5l7 7-7 7M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', title: 'Island-Wide Delivery',  body: 'Reliable delivery across all 25 districts. Free on orders over Rs. 5,000.' },
  { id: 'quality',  iconPath: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z', title: 'Certified Quality',     body: 'Every fabric is quality-checked before dispatch. Authentic and durable.' },
  { id: 'returns',  iconPath: 'M3 2v6h6M3 8C4.657 4.953 8.045 3 12 3c4.418 0 8 3.582 8 8s-3.582 8-8 8c-3.566 0-6.618-2.167-7.747-5.25',                                                       title: 'Hassle-Free Returns',  body: '7-day returns on eligible items. Straightforward process, no questions asked.' },
  { id: 'secure',   iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',                                                                                                                     title: 'Secure Checkout',      body: 'SSL-encrypted transactions. Your payment data is always protected.' },
];

const WHY_US = [
  { id: 'experience', num: '15+',   label: 'Years in Business',    body: 'Established in 2009, we have built deep supplier relationships and an unmatched local reputation.' },
  { id: 'products',   num: '500+',  label: 'Fabric Variants',      body: 'From uniform-grade drill fabric to luxury silks — the broadest selection of any retailer in Sri Lanka.' },
  { id: 'customers',  num: '10K+',  label: 'Satisfied Customers',  body: 'Families, schools, and corporates across all provinces return to us season after season.' },
  { id: 'districts',  num: '25',    label: 'Districts Delivered',   body: 'Our logistics network covers every district island-wide with fast, trackable delivery.' },
];

/* ── Brand Logo SVGs ──────────────────────────────────────────── */
const LogoAivo = () => (
  <svg width="140" height="50" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 10L24.5 22L36 24.5L24.5 27L22 38.5L19.5 27L8 24.5L19.5 22L22 10Z" fill="#0083c4" stroke="#0083c4" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M16 16L18 23L25 25L18 27L16 34L14 27L7 25L14 23L16 16Z" fill="#fff"/>
    <text x="44" y="28" fontFamily="var(--font-sans)" fontSize="20" fontWeight="700" fill="#0083c4" letterSpacing="-0.02em">Aivo</text>
    <text x="44" y="38" fontFamily="var(--font-mono)" fontSize="6" fontWeight="600" fill="#a8a8a8" letterSpacing="0.18em">SPECIAL GUEST</text>
  </svg>
);
const LogoUSPolo = () => (
  <svg width="140" height="50" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 8C22 8 20.5 10 19 11.5C18 12.5 17 14 17.5 15.5C18 17 19.5 18 20.5 19C21 19.5 21.5 20.5 21.5 21.5C21.5 23 20 24.5 19 25.5C18.5 26 18 27 18.5 28C19 29 20.5 29.5 21.5 29.5C23 29.5 24 28 24.5 27C25 26 26.5 25 26 23C25.5 21 24.5 19 24.5 18.5C24.5 18 25 17.5 25.5 17.5C26 17.5 27 18 27.5 18.5C28.5 19.5 29 21.5 30 22C30.5 22.5 31.5 21.5 31 20.5C30.5 19.5 29 17 28 15.5C27 14 25.5 12 25.5 11.5C25.5 11 26 10.5 26.5 10.5C27 10.5 28.5 12 29 12.5C29.5 13 30.5 12.5 30 11.5C29.5 10.5 27.5 8 26.5 7C25.5 6 24 5 23 5C22 5 22 8 22 8Z" fill="#1d2e5a"/>
    <text x="36" y="24" fontFamily="var(--font-serif)" fontSize="12" fontWeight="700" fill="#1d2e5a" letterSpacing="0.05em">U.S. POLO ASSN.</text>
    <text x="36" y="32" fontFamily="var(--font-mono)" fontSize="5.5" fontWeight="500" fill="#a8a8a8" letterSpacing="0.1em">SINCE 1890</text>
  </svg>
);
const LogoGiggles = () => (
  <svg width="140" height="50" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="14" y="30" fontFamily="var(--font-sans)" fontSize="26" fontWeight="800" fill="#b0268d" letterSpacing="-0.04em">Giggles</text>
    <text x="16" y="40" fontFamily="var(--font-mono)" fontSize="5.5" fontWeight="600" fill="#a8a8a8" letterSpacing="0.1em">INFANT COLLECTION</text>
  </svg>
);
const LogoFlipFlop = () => (
  <svg width="140" height="50" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="16" y="30" fontFamily="var(--font-sans)" fontSize="22" fontWeight="700" fill="#0b7a8d" letterSpacing="0.02em">Flip Flop</text>
    <text x="18" y="38" fontFamily="var(--font-mono)" fontSize="5.5" fontWeight="500" fill="#a8a8a8" letterSpacing="0.08em">CASUAL FOOTWEAR</text>
  </svg>
);
const LogoEthnicFusion = () => (
  <svg width="150" height="50" viewBox="0 0 150 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="140" height="40" fill="#091428" rx="2"/>
    <text x="16" y="29" fontFamily="var(--font-serif)" fontSize="15" fontStyle="italic" fill="#e8c84a" letterSpacing="0.04em">Ethnic Fusion</text>
  </svg>
);

const BRANDS = [
  { name: 'Aivo',          render: LogoAivo },
  { name: 'U.S. Polo Assn.', render: LogoUSPolo },
  { name: 'Giggles',       render: LogoGiggles },
  { name: 'Flip Flop',     render: LogoFlipFlop },
  { name: 'Ethnic Fusion', render: LogoEthnicFusion },
];

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading,  setLoading]        = useState(true);
  const [slide,    setSlide]          = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Slider */
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5500);
  }, []);
  const goToSlide = useCallback((i: number) => {
    setSlide(i);
    if (timerRef.current) clearInterval(timerRef.current);
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  /* Products */
  useEffect(() => {
    api.getProducts({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' })
      .then(r => setProducts(r.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const current = HERO_SLIDES[slide];

  return (
    <div style={{ background: 'var(--clr-surface)' }}>

      {/* ══════════════════════════════════════════════════
          HERO SLIDER
      ══════════════════════════════════════════════════ */}
      <section
        id="hero"
        aria-label="Hero banner"
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: 'min(92vh, 720px)',
          display: 'flex',
          alignItems: 'center',
          background: 'var(--obsidian-950)',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${current.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'background-image 0.8s ease',
            zIndex: 0,
          }}
        />
        {/* Dark overlay for readability */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        {/* Ambient gradient */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse 70% 70% at 65% 40%, ${current.accentColor === 'var(--gold-500)' ? 'rgba(212,175,55,0.1)' : 'rgba(204,0,0,0.15)'} 0%, transparent 70%)`,
            transition: 'background 0.8s ease',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        {/* Fine grid texture */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 2, padding: '6rem 2rem 5rem' }}>
          <div style={{ maxWidth: '680px' }}>

            {/* Eyebrow */}
            <div
              key={`eyebrow-${current.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '2rem',
                animation: 'fadeInUp 0.5s var(--ease-out-expo) both',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '28px',
                  height: '1.5px',
                  background: current.accentColor,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  fontWeight: 400,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: current.accentColor,
                }}
              >
                {current.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <h1
              key={`h1-${current.id}`}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.4rem, 5.5vw, 4.25rem)',
                fontWeight: 600,
                lineHeight: 1.08,
                letterSpacing: '-0.015em',
                color: '#fff',
                marginBottom: '1.5rem',
                animation: 'fadeInUp 0.55s 0.08s var(--ease-out-expo) both',
              }}
            >
              {current.headline}
            </h1>

            {/* Body */}
            <p
              key={`body-${current.id}`}
              style={{
                fontSize: '1rem',
                lineHeight: 1.8,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: '2.5rem',
                maxWidth: '520px',
                animation: 'fadeInUp 0.55s 0.16s var(--ease-out-expo) both',
              }}
            >
              {current.subheadline}
            </p>

            {/* CTAs */}
            <div
              key={`ctas-${current.id}`}
              style={{
                display: 'flex',
                gap: '0.875rem',
                flexWrap: 'wrap',
                animation: 'fadeInUp 0.55s 0.24s var(--ease-out-expo) both',
              }}
            >
              <Link href={current.primaryCta.href} id={`hero-primary-${current.id}`} className="btn btn-brand btn-lg">
                {current.primaryCta.label}
                <IconArrow />
              </Link>
              <Link href={current.secondaryCta.href} className="btn btn-ghost-white btn-lg">
                {current.secondaryCta.label}
              </Link>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                gap: '2.5rem',
                marginTop: '4rem',
                paddingTop: '2rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                animation: 'fadeInUp 0.55s 0.32s var(--ease-out-expo) both',
                flexWrap: 'wrap',
              }}
            >
              {WHY_US.slice(0, 3).map(s => (
                <div key={s.id}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600, color: current.accentColor, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {s.num}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <div
          style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            zIndex: 5,
          }}
        >
          <button
            id="hero-prev"
            aria-label="Previous slide"
            onClick={() => goToSlide((slide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 200ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--clr-brand)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
          >
            <IconChevronLeft />
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                id={`hero-dot-${i}`}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goToSlide(i)}
                style={{
                  height: '2px',
                  width: i === slide ? '32px' : '16px',
                  background: i === slide ? 'var(--clr-brand)' : 'rgba(255,255,255,0.25)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 300ms var(--ease-out-expo)',
                  borderRadius: '1px',
                }}
              />
            ))}
          </div>

          <button
            id="hero-next"
            aria-label="Next slide"
            onClick={() => goToSlide((slide + 1) % HERO_SLIDES.length)}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 200ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--clr-brand)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--clr-brand)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
          >
            <IconChevronRight />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          MARQUEE TICKER
      ══════════════════════════════════════════════════ */}
      <div
        id="marquee-ticker"
        style={{
          background: 'var(--clr-brand)',
          padding: '0.625rem 0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2.5rem',
                paddingRight: '5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 400,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.9)',
                whiteSpace: 'nowrap',
              }}
            >
              {item}
              <span style={{ display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TRUST STRIP
      ══════════════════════════════════════════════════ */}
      <section
        id="trust-strip"
        style={{ background: '#fff', borderBottom: '1px solid var(--clr-border-2)', padding: '2.5rem 0' }}
      >
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {TRUST_ITEMS.map(t => (
              <div key={t.id} id={`trust-${t.id}`} className="trust-item">
                <div className="trust-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.iconPath} />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--clr-text)', marginBottom: '0.2rem' }}>{t.title}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--clr-text-2)', lineHeight: 1.6 }}>{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CATEGORIES
      ══════════════════════════════════════════════════ */}
      <section id="categories" style={{ padding: 'var(--space-section) 0', background: 'var(--warm-50)' }}>
        <div className="container">
          <div className="section-header-center">
            <span className="label-eyebrow">Browse</span>
            <h2 className="heading-xl">Shop by Category</h2>
            <span className="section-rule" />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '0.875rem',
            }}
          >
            {CATEGORIES.map((cat, idx) => (
              <Link
                key={cat.id}
                href={cat.href}
                id={`cat-${cat.id}`}
                className="cat-card animate-fade-in-up"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  animationDelay: `${idx * 0.06}s`,
                  borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="cat-card-inner"
                  style={{
                    background: cat.bg,
                    aspectRatio: '3 / 4',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '1.25rem',
                    position: 'relative',
                  }}
                >
                  {/* Subtle texture */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0, rgba(255,255,255,0.012) 1px, transparent 0, transparent 50%)',
                      backgroundSize: '14px 14px',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Gradient overlay */}
                  <div
                    className="cat-card-overlay"
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  {/* Text */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.58rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '0.3rem',
                      }}
                    >
                      {cat.subLabel}
                    </p>
                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.2rem',
                        fontWeight: 600,
                        color: '#fff',
                        lineHeight: 1.2,
                      }}
                    >
                      {cat.label}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        marginTop: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--clr-brand)',
                      }}
                    >
                      View All
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          UNIFORM COLLECTION
      ══════════════════════════════════════════════════ */}
      <section id="uniforms" style={{ padding: 'var(--space-section) 0', background: 'var(--obsidian-950)' }}>
        <div className="container">
          <div className="section-header-center">
            <span className="label-eyebrow" style={{ color: 'rgba(255,255,255,0.4)' }}>Specialist Range</span>
            <h2
              className="heading-xl"
              style={{ color: '#fff' }}
            >
              Uniform Collection
            </h2>
            <span className="section-rule" />
            <p
              style={{
                marginTop: '1.25rem',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.9375rem',
                lineHeight: 1.75,
                maxWidth: '520px',
              }}
            >
              Government &amp; private school uniforms, corporate formal wear, and industrial workwear — all under one roof, crafted with precision.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1px',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            {UNIFORM_SEGMENTS.map((seg, idx) => (
              <Link
                key={seg.id}
                href={seg.href}
                id={`uniform-${seg.id}`}
                className="animate-fade-in-up"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  background: seg.bg,
                  padding: '2.25rem 1.75rem',
                  borderRight: idx % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  transition: 'background 300ms ease',
                  animationDelay: `${idx * 0.07}s`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${seg.bg.slice(0, seg.bg.lastIndexOf(','))} , rgba(204,0,0,0.06))`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = seg.bg; }}
              >
                {seg.badge && (
                  <span
                    className="badge badge-brand"
                    style={{ marginBottom: '1.25rem', display: 'inline-flex' }}
                  >
                    {seg.badge}
                  </span>
                )}
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: '#fff',
                    lineHeight: 1.25,
                    marginBottom: '0.75rem',
                  }}
                >
                  {seg.label}
                </h3>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.75,
                    color: 'rgba(255,255,255,0.45)',
                    marginBottom: '1.5rem',
                  }}
                >
                  {seg.description}
                </p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--clr-brand)',
                    transition: 'gap 200ms ease',
                  }}
                >
                  Shop Now
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link href="/products?category=uniforms" id="view-all-uniforms" className="btn btn-ghost-white btn-lg">
              View Entire Uniform Range
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          LATEST ARRIVALS
      ══════════════════════════════════════════════════ */}
      <section id="latest-arrivals" style={{ padding: 'var(--space-section) 0', background: '#fff' }}>
        <div className="container">
          <div className="section-header">
            <div>
              <span className="label-eyebrow">Fresh In</span>
              <h2 className="heading-xl" style={{ marginTop: '0.625rem' }}>Latest Arrivals</h2>
            </div>
            <Link
              href="/products?sort=newest"
              id="view-all-products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--clr-brand)',
                textDecoration: 'none',
                paddingBottom: '1px',
                borderBottom: '1px solid var(--clr-brand)',
                transition: 'gap 200ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.gap = '0.875rem')}
              onMouseLeave={e => (e.currentTarget.style.gap = '0.5rem')}
            >
              View All Products <IconArrow />
            </Link>
          </div>

          {loading ? (
            <div className="product-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: '3/4' }} />
              ))}
            </div>
          ) : (
            <div className="product-grid">
              {products.map((product, idx) => (
                <ProductCard key={product.id} product={product} index={idx} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SCHOOL UNIFORM BANNER
      ══════════════════════════════════════════════════ */}
      <section
        id="school-banner"
        style={{
          background: 'linear-gradient(130deg, var(--crimson-900) 0%, var(--crimson-800) 40%, var(--crimson-700) 100%)',
          padding: 'var(--space-section) 0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Texture */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0, rgba(255,255,255,0.012) 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
          }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '3rem',
              alignItems: 'center',
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '1.25rem',
                }}
              >
                Back to School — Season Open
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)',
                  fontWeight: 600,
                  color: '#fff',
                  lineHeight: 1.15,
                  letterSpacing: '-0.01em',
                  marginBottom: '1rem',
                }}
              >
                School Uniform Orders Now Open
              </h2>
              <p
                style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.8,
                  color: 'rgba(255,255,255,0.6)',
                  maxWidth: '520px',
                }}
              >
                Government and private school uniforms crafted to specification. Bulk orders welcome with competitive pricing for institutions.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
              <Link
                href="/products?category=uniforms&sub=government-school"
                id="banner-govt-uniforms"
                className="btn btn-white btn-lg"
                style={{ minWidth: '230px', justifyContent: 'center' }}
              >
                Government School Uniforms
              </Link>
              <Link
                href="/products?category=uniforms&sub=private-school"
                id="banner-private-uniforms"
                className="btn btn-ghost-white btn-lg"
                style={{ minWidth: '230px', justifyContent: 'center' }}
              >
                Private School Uniforms
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          OUR BRANDS SHOWCASE
      ══════════════════════════════════════════════════ */}
      <section
        id="our-brands"
        style={{
          padding: '4.5rem 0',
          background: 'var(--warm-50)',
          borderTop: '1px solid var(--clr-border-2)',
          borderBottom: '3px solid var(--clr-brand)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="container">
          <div className="section-header-center" style={{ marginBottom: '2.5rem' }}>
            <span className="label-eyebrow">Partners</span>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--clr-text)',
                margin: 0,
              }}
            >
              Our Brands
            </h2>
            <span className="section-rule" />
            <p style={{ marginTop: '0.75rem', color: 'var(--clr-text-2)', fontSize: '0.875rem' }}>
              Trusted partners crafting premium quality fabrics and fashion for Sri Lanka
            </p>
          </div>

          {/* Continuous scrolling brand marquee */}
          <div
            className="brands-marquee-container"
            style={{
              overflow: 'hidden',
              position: 'relative',
            }}
            onMouseEnter={e => (e.currentTarget.querySelector('.brands-marquee-track') as HTMLElement | null)?.style.setProperty('animation-play-state', 'paused')}
            onMouseLeave={e => (e.currentTarget.querySelector('.brands-marquee-track') as HTMLElement | null)?.style.setProperty('animation-play-state', 'running')}
          >
            <div className="brands-marquee-track">
              {[...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS].map((brand, idx) => {
                const BrandLogo = brand.render;
                return (
                  <div key={idx} className="brand-slide">
                    <div className="brand-slide-inner">
                      <BrandLogo />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="why-us" style={{ padding: 'var(--space-section) 0', background: 'var(--warm-50)' }}>
        <div className="container">
          <div className="section-header-center">
            <span className="label-eyebrow">Our Story</span>
            <h2 className="heading-xl">Why Nandana Textile?</h2>
            <span className="section-rule" />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1px',
              background: 'var(--clr-border)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
            }}
          >
            {WHY_US.map((item, idx) => (
              <div
                key={item.id}
                id={`why-${item.id}`}
                style={{
                  background: '#fff',
                  padding: '2.5rem 2rem',
                  transition: 'background 200ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--warm-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '3rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: 'var(--clr-brand)',
                    marginBottom: '0.5rem',
                  }}
                >
                  {item.num}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    fontWeight: 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--clr-text-3)',
                    marginBottom: '1rem',
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.75,
                    color: 'var(--clr-text-2)',
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════ */}
      <section
        id="final-cta"
        style={{
          background: 'var(--obsidian-950)',
          padding: 'var(--space-section) 0',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(204,0,0,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div className="container-xs" style={{ position: 'relative', zIndex: 1 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              fontWeight: 400,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '1.75rem',
            }}
          >
            <span style={{ display: 'block', width: '20px', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
            Nandana Textile — Est. 2009
            <span style={{ display: 'block', width: '20px', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2rem, 4vw, 3.25rem)',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.12,
              letterSpacing: '-0.01em',
              marginBottom: '1.25rem',
            }}
          >
            Quality Textiles for Every Sri Lankan
          </h2>

          <p
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.8,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: '2.5rem',
            }}
          >
            From school uniforms to evening sarees — trusted by thousands of families across the island.
          </p>

          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/products" id="final-cta-shop" className="btn btn-brand btn-xl">
              Shop Now
              <IconArrow />
            </Link>
            <Link href="/products?category=uniforms" id="final-cta-uniforms" className="btn btn-ghost-white btn-xl">
              View Uniforms
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
