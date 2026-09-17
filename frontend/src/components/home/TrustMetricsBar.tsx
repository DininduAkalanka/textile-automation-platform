'use client';

const TRUST_BENEFITS = [
  {
    id: 'delivery',
    title: 'Island-Wide Delivery',
    subtitle: 'Free delivery on orders over Rs. 5,000 across all 25 districts.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="13" x="1" y="5" rx="2" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'quality',
    title: 'Certified Quality',
    subtitle: 'Rigorous fabric inspection for color-fastness, weave & durability.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'returns',
    title: '7-Day Easy Returns',
    subtitle: 'Hassle-free replacement or store exchange on eligible garments.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    id: 'secure',
    title: 'Secure Checkout',
    subtitle: 'Encrypted bank-grade card processing, KOKO BNPL & Cash on Delivery.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const PROOF_METRICS = [
  { num: '15+', label: 'Years Experience', note: 'Established 2009' },
  { num: '500+', label: 'Fabric Variants', note: 'Cottons, Silks & Uniform Weaves' },
  { num: '10K+', label: 'Satisfied Customers', note: 'Island-Wide Repeat Trust' },
  { num: '25', label: 'Districts Served', note: 'Nationwide Logistics' },
];

export function TrustMetricsBar() {
  return (
    <section
      id="trust-metrics"
      aria-label="Trust and Key Metrics"
      className="w-full bg-white border-b border-[var(--clr-border-2)]"
    >
      {/* ── Trust Benefits Strip (Thilakawardhana Style) ── */}
      <div className="container-wide py-7 sm:py-8 border-b border-neutral-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
          {TRUST_BENEFITS.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 p-2.5 rounded-lg transition-colors duration-150 hover:bg-neutral-50/80"
            >
              <div className="shrink-0 w-11 h-11 rounded-full bg-[var(--clr-brand-tint)] text-[var(--clr-brand)] flex items-center justify-center border border-[var(--clr-brand)]/15">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h4 className="text-[0.9375rem] font-bold text-neutral-900 leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Business Credibility Metrics ── */}
      <div className="container-wide py-6 bg-[var(--warm-50)]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200/80">
          {PROOF_METRICS.map((stat, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center text-center px-4 ${
                idx > 0 ? 'pt-4 sm:pt-0' : ''
              }`}
            >
              <div className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--clr-brand)] tracking-tight">
                {stat.num}
              </div>
              <div className="font-sans text-xs sm:text-[0.8125rem] font-bold uppercase tracking-wider text-neutral-900 mt-1">
                {stat.label}
              </div>
              <div className="font-mono text-[0.65rem] text-neutral-500 tracking-wide mt-0.5">
                {stat.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
