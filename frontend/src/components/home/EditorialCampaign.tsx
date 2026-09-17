'use client';

import Link from 'next/link';
import Image from 'next/image';

export function EditorialCampaign() {
  return (
    <section
      id="editorial-campaign"
      aria-label="Editorial Brand Campaign"
      className="w-full bg-[var(--obsidian-950)] text-white relative overflow-hidden py-16 sm:py-24"
    >
      {/* Background Editorial Visual */}
      <div className="absolute inset-0 z-0 opacity-45">
        <Image
          src="/images/categories/fabrics.jpg"
          alt="Sri Lankan Handloom & Fine Textile Artistry"
          fill
          sizes="100vw"
          className="object-cover object-center filter saturate-110"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(8,8,8,0.95) 0%, rgba(8,8,8,0.75) 50%, rgba(8,8,8,0.4) 100%)',
          }}
        />
      </div>

      <div className="container-wide relative z-10">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2.5 mb-3.5">
            <span className="w-6 h-[1.5px] bg-[var(--clr-gold)] inline-block" />
            <span className="font-mono text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-[var(--clr-gold)]">
              HERITAGE & CRAFTSMANSHIP
            </span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight mb-4">
            Sri Lankan Textile Craft &amp; Everyday Elegance
          </h2>

          <p className="text-sm sm:text-base leading-relaxed text-neutral-300 mb-8">
            Every thread reflects our 15-year legacy of sourcing pure cottons, vibrant silks, and precision-tested suiting fabrics across the island. Designed for authentic comfort and lasting dignity.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/products?category=women"
              className="btn btn-brand btn-md sm:btn-lg shadow-lg hover:shadow-xl transition-all"
            >
              <span>Explore Women &amp; Handlooms</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/products?category=fabrics"
              className="btn btn-ghost-white btn-md sm:btn-lg"
            >
              Discover Fabric Cuts
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
