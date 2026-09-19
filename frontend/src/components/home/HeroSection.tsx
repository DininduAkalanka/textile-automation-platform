'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';

export interface HeroSlide {
  id: number;
  title: string;
  href: string;
  image: string;
  alt: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    title: 'Ethnic Fusion & The Silk Element',
    href: '/products?category=women',
    image: '/images/hero/hero-banner-silk-sarees.png',
    alt: 'Ethnic Fusion - The Silk Element Luxury Sarees & Festive Fashion',
  },
  {
    id: 2,
    title: 'A True Modern Classic',
    href: '/products?category=women',
    image: '/images/hero/hero-banner-modern-classic.png',
    alt: 'A True Modern Classic - Contemporary Sri Lankan Fashion',
  },
  {
    id: 3,
    title: 'SAVAGE Contemporary Streetwear & Youth Fashion',
    href: '/products?category=teenagers',
    image: '/images/hero/hero-banner-savage.png',
    alt: 'SAVAGE - Wings of Freedom Graphic Tees & Urban Streetwear',
  },
  {
    id: 4,
    title: 'The Workwear Edit - Tailored & Timeless',
    href: '/products?category=uniforms',
    image: '/images/hero/hero-banner-tendenza.png',
    alt: 'The Workwear Edit - Tailored Suiting & Corporate Apparel',
  },
  {
    id: 5,
    title: 'Contemporary Denim & Youth Weaves',
    href: '/products?category=teenagers',
    image: '/images/hero/hero-banner-denim.png',
    alt: 'Denim Collection - Everyday Casual Fit',
  },
  {
    id: 6,
    title: 'Golden Escape Resort & Linen Collection',
    href: '/products?category=women',
    image: '/images/hero/hero-banner-golden-escape.png',
    alt: 'Golden Escape - Resort Wear & Summer Linens',
  },
];

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = HERO_SLIDES.length;

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToSlide = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  // Autoplay with pause on hover
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      nextSlide();
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, nextSlide]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      nextSlide();
    } else if (distance < -50) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      nextSlide();
    }
  };

  return (
    <section
      id="hero-banner-swapper"
      aria-label="Main Banner Slider"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full overflow-hidden bg-neutral-100 select-none group/banner focus:outline-none"
    >
      {/* Editorial Storefront Brand Badge & Primary SEO Heading */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-6 z-20 pointer-events-none">
        <h1 className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white/95 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded border border-white/20 shadow-sm inline-block">
          Nandana Textile &bull; Sri Lanka
        </h1>
      </div>

      {/* Full-width responsive banner viewport matching Fashion Bug & Thilakawardhana standards (1920x630 aspect ratio for 100% full fit without cropping) */}
      <div className="relative w-full aspect-[1920/630] overflow-hidden bg-neutral-950">
        {/* Sliding Track */}
        <div
          className="flex h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            transform: `translateX(-${current * 100}%)`,
          }}
        >
          {HERO_SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className="relative w-full h-full shrink-0 grow-0 basis-full"
              aria-hidden={idx !== current}
            >
              <Link
                href={slide.href}
                className="block w-full h-full relative cursor-pointer"
                tabIndex={idx === current ? 0 : -1}
                aria-label={slide.title}
              >
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  priority={idx === 0}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  sizes="100vw"
                  quality={92}
                  className="object-cover object-center w-full h-full"
                />
              </Link>
            </div>
          ))}
        </div>

        {/* Side Floating Circular Navigation Arrows (Thilakawardhana signature layout) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            prevSlide();
          }}
          aria-label="Previous banner"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/75 hover:bg-white text-neutral-800 border border-neutral-300/80 shadow-md hover:shadow-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100 active:scale-95 cursor-pointer backdrop-blur-[2px]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            nextSlide();
          }}
          aria-label="Next banner"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/75 hover:bg-white text-neutral-800 border border-neutral-300/80 shadow-md hover:shadow-lg flex items-center justify-center transition-all opacity-85 hover:opacity-100 active:scale-95 cursor-pointer backdrop-blur-[2px]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Signature Bottom Center Pagination Dots */}
        <div
          className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full"
          role="tablist"
          aria-label="Slide pagination"
        >
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToSlide(i);
              }}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                i === current
                  ? 'w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#CC0000] shadow-sm scale-110'
                  : 'w-2 h-2 sm:w-2.5 sm:h-2.5 bg-neutral-800/40 hover:bg-neutral-800/70'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
