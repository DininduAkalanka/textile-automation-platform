'use client';

import Link from 'next/link';
import Image from 'next/image';

interface UniformSegment {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  href: string;
  image: string;
}

const UNIFORM_TILES: UniformSegment[] = [
  {
    id: 'school',
    title: 'School Uniforms',
    subtitle: 'Government & Private Standards',
    description: 'Ministry regulation 5-pleat & box-pleat pinafores, boys regulation shirts & shorts, and private academy suiting.',
    badge: 'Regulation Approved',
    href: '/products?category=school-uniforms',
    image: '/images/uniforms/school-girls-pinafore.jpg',
  },
  {
    id: 'corporate',
    title: 'Corporate Formal Wear',
    subtitle: 'Executive Suiting & Office Attire',
    description: 'Tailored blazers, wrinkle-resistant executive trousers, and oxford shirting designed for day-long comfort.',
    badge: 'Tailored Fit',
    href: '/products?category=corporate-uniforms',
    image: '/images/uniforms/corporate-executive-blazer.jpg',
  },
  {
    id: 'industrial',
    title: 'Workwear & Industrial',
    subtitle: 'Safety & Heavy Duty Drill',
    description: 'Engineered high-visibility jackets, heavy-duty cargo utility trousers, and rugged protective coveralls.',
    badge: 'High Durability',
    href: '/products?category=industrial-uniforms',
    image: '/images/uniforms/hivis-safety-jacket.jpg',
  },
  {
    id: 'healthcare',
    title: 'Healthcare & Hospitality',
    subtitle: 'Medical Scrubs & Service Apparel',
    description: 'Anti-microbial medical scrubs, clinical lab coats, and bespoke chef jackets tailored for professional service.',
    badge: 'Clinical Grade',
    href: '/products?category=healthcare-uniforms',
    image: '/images/uniforms/medical-scrubs.jpg',
  },
];

export function UniformSolutionsSection() {
  return (
    <section
      id="uniform-solutions"
      aria-label="Institutional Uniform Solutions"
      className="w-full py-16 sm:py-20 bg-[var(--obsidian-950)] text-white relative overflow-hidden"
    >
      <div className="container-wide relative z-10">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-[var(--gold-400)] mb-1">
              <span className="w-5 h-[1.5px] bg-[var(--gold-400)] inline-block" />
              SPECIALIST INSTITUTIONAL RANGE
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Uniform Solutions
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 mt-2 max-w-2xl leading-relaxed">
              Serving schools, corporate headquarters, hospitals, and industrial teams nationwide with exact regulation specifications and made-to-measure tailoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/products?category=uniforms"
              className="btn btn-brand btn-md shadow-md"
            >
              <span>Explore Uniform Catalog</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="https://wa.me/94717088445?text=Hello%20Nandana%20Textile,%20I%20would%20like%20to%20request%20a%20quote%20for%20bulk%20uniforms."
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost-white btn-md"
            >
              Request Bulk Quote
            </Link>
          </div>
        </div>

        {/* 4 Uniform Solution Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {UNIFORM_TILES.map((seg) => (
            <Link
              key={seg.id}
              href={seg.href}
              id={`uniform-tile-${seg.id}`}
              className="group relative flex flex-col justify-between rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900/60 p-6 sm:p-7 min-h-[320px] transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900 shadow-lg"
            >
              {/* Background Uniform Image */}
              <div className="absolute inset-0 z-0">
                <Image
                  src={seg.image}
                  alt={seg.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover object-center opacity-25 filter grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-106 group-hover:opacity-35"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(8,8,8,0.95) 0%, rgba(8,8,8,0.7) 60%, rgba(8,8,8,0.4) 100%)',
                  }}
                />
              </div>

              {/* Badge & Title */}
              <div className="relative z-10">
                <span className="inline-block px-2.5 py-1 text-[0.65rem] font-mono font-bold uppercase tracking-wider text-[var(--gold-400)] bg-[var(--gold-400)]/10 border border-[var(--gold-400)]/20 rounded mb-4">
                  {seg.badge}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  {seg.title}
                </h3>
                <p className="font-mono text-[0.6875rem] font-semibold text-neutral-400 uppercase tracking-wider mt-1">
                  {seg.subtitle}
                </p>
              </div>

              {/* Description & Action */}
              <div className="relative z-10 pt-4 border-t border-white/10 mt-6">
                <p className="text-xs text-neutral-300/85 leading-relaxed mb-4">
                  {seg.description}
                </p>
                <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--clr-brand)] group-hover:text-red-400 group-hover:gap-2 transition-all">
                  <span>View Specifications</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
