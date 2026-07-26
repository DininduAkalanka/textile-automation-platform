'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand/brand-mark';

/**
 * Two-panel auth layout (split-screen — the pattern Clerk, Linear and modern
 * e-commerce use): a full-bleed photographic brand panel on the left, the form
 * on the right. Photography + typography, no icon-slides or filler gradients.
 *
 * Palette: red + black (the Nandana Textile identity). Black is the dominant,
 * premium base; red is the accent (logo, links, the divider rule). Real textile
 * photos cross-fade behind a near-black scrim.
 *
 * Responsive: two columns on lg+, single column below lg where the photo panel
 * drops away — the form gets its own compact logo and the contact details move
 * beneath it so nothing is lost. Cross-fade respects prefers-reduced-motion.
 */

const HERO_IMAGES = [
  '/images/hero2.png', // premium school uniforms + corporate collection
  '/images/hero3.png', // red & gold saree
  '/images/hero1.png', // red/black fashion editorial
  '/auth/hero-1.jpg',
  '/auth/hero-2.jpg',
];

const BRAND = 'Nandana Textile';

// A premium, not-quite-black form ground: a warm near-charcoal with a soft red
// glow in the top corner. Dark enough to feel premium, light enough to stay
// clean and easy on the eyes.
const FORM_BG =
  'radial-gradient(130% 90% at 100% 0%, rgba(204,0,0,0.13), transparent 55%), linear-gradient(165deg, #1f191c 0%, #15111360 40%, #141012 100%)';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 lg:grid lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      {/* Form column — labels themed for the dark ground via one arbitrary
          selector, so the shared FormField (and the indigo storefront) is
          untouched. */}
      <div
        className="flex min-h-screen flex-col px-5 py-8 sm:px-10 [&_label]:text-white/70"
        style={{ background: FORM_BG }}
      >
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
          {/* Compact logo — shown where the brand panel isn't. */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2.5 no-underline lg:hidden"
          >
            <LogoMark />
            <span className="font-display text-xl font-bold tracking-tight text-white">
              {BRAND}
            </span>
          </Link>

          {children}
        </div>

        {/* Contact — under the form on mobile (the brand panel carries it on lg). */}
        <div className="mx-auto w-full max-w-[400px] border-t border-white/10 pt-6 lg:hidden">
          <ContactInfo variant="dark" />
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = setInterval(
      () => setActive((i) => (i + 1) % HERO_IMAGES.length),
      5500,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="relative hidden overflow-hidden bg-neutral-950 lg:block">
      {/* Cross-fading photography */}
      {HERO_IMAGES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- decorative
        // full-bleed background; next/image's fill layout adds no value here.
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ease-in-out ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Near-black scrim, with a whisper of red at the base for brand warmth. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(10,10,10,0.92) 0%, rgba(20,10,10,0.55) 40%, rgba(10,10,10,0.30) 100%)',
        }}
      />

      {/* Content over the photo */}
      <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
        <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
          <LogoMark />
          <span className="font-display text-xl font-bold text-white">
            {BRAND}
          </span>
        </Link>

        <div>
          <div className="max-w-md">
            <p className="mb-4 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              <span className="h-px w-6 bg-[#E60000]" />
              Sri Lanka’s textile house
            </p>
            <h2 className="font-display text-[34px] font-bold leading-[1.15] text-white xl:text-[40px]">
              Uniforms, fabrics &amp; made-to-measure.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
              Measured, made and delivered island-wide — with the whole catalogue
              a click away.
            </p>
          </div>

          <div className="mt-10 border-t border-white/15 pt-6">
            <ContactInfo variant="dark" />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Business contact block — appears on the brand panel (dark) and under the
 *  form on mobile (light). Phones are tappable. */
function ContactInfo({ variant }: { variant: 'dark' | 'light' }) {
  const dark = variant === 'dark';
  const muted = dark ? 'text-white/55' : 'text-neutral-500';
  const strong = dark ? 'text-white/80' : 'text-neutral-700';
  const link = dark ? 'text-white/80 hover:text-white' : 'text-neutral-700 hover:text-[#CC0000]';

  return (
    <div className={`text-[12.5px] leading-relaxed ${dark ? '' : 'mt-8 border-t border-neutral-200 pt-6'}`}>
      <p className={`font-semibold ${strong}`}>{BRAND}</p>
      <p className={muted}>50 Main St, Veyangoda</p>
      <p className={`mt-1 ${muted}`}>
        <a href="tel:0332288445" className={link}>
          Landline 033&nbsp;228&nbsp;8445
        </a>
        <span className="px-1.5 opacity-40">·</span>
        <a
          href="https://wa.me/94717088445"
          target="_blank"
          rel="noopener noreferrer"
          className={link}
        >
          WhatsApp 071&nbsp;708&nbsp;8445
        </a>
      </p>
    </div>
  );
}

function LogoMark() {
  // Both auth grounds are dark (the photo panel and the charcoal form column),
  // so the mark always uses its on-dark treatment.
  return <BrandMark size={40} variant="onDark" />;
}
