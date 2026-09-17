'use client';

const LogoAivo = () => (
  <svg width="120" height="38" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 10L24.5 22L36 24.5L24.5 27L22 38.5L19.5 27L8 24.5L19.5 22L22 10Z" fill="#0083c4" stroke="#0083c4" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M16 16L18 23L25 25L18 27L16 34L14 27L7 25L14 23L16 16Z" fill="#fff"/>
    <text x="44" y="28" fontFamily="var(--font-sans)" fontSize="20" fontWeight="700" fill="#0083c4" letterSpacing="-0.02em">Aivo</text>
    <text x="44" y="38" fontFamily="var(--font-mono)" fontSize="6" fontWeight="600" fill="#888" letterSpacing="0.18em">SPECIAL GUEST</text>
  </svg>
);

const LogoUSPolo = () => (
  <svg width="130" height="38" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="14" y="24" fontFamily="var(--font-serif)" fontSize="12" fontWeight="700" fill="#1d2e5a" letterSpacing="0.05em">U.S. POLO ASSN.</text>
    <text x="14" y="33" fontFamily="var(--font-mono)" fontSize="6" fontWeight="500" fill="#888" letterSpacing="0.12em">SINCE 1890</text>
  </svg>
);

const LogoGiggles = () => (
  <svg width="110" height="38" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="14" y="30" fontFamily="var(--font-sans)" fontSize="24" fontWeight="800" fill="#b0268d" letterSpacing="-0.03em">Giggles</text>
    <text x="16" y="39" fontFamily="var(--font-mono)" fontSize="5.5" fontWeight="600" fill="#888" letterSpacing="0.1em">INFANT COLLECTION</text>
  </svg>
);

const LogoFlipFlop = () => (
  <svg width="110" height="38" viewBox="0 0 140 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="16" y="29" fontFamily="var(--font-sans)" fontSize="20" fontWeight="700" fill="#0b7a8d" letterSpacing="0.02em">Flip Flop</text>
    <text x="18" y="38" fontFamily="var(--font-mono)" fontSize="5.5" fontWeight="500" fill="#888" letterSpacing="0.08em">CASUAL FOOTWEAR</text>
  </svg>
);

const LogoEthnicFusion = () => (
  <svg width="130" height="38" viewBox="0 0 150 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="8" width="135" height="34" fill="#091428" rx="3"/>
    <text x="16" y="30" fontFamily="var(--font-serif)" fontSize="14" fontStyle="italic" fill="#e8c84a" letterSpacing="0.04em">Ethnic Fusion</text>
  </svg>
);

const BRANDS = [
  { name: 'Aivo', render: LogoAivo },
  { name: 'U.S. Polo Assn.', render: LogoUSPolo },
  { name: 'Giggles', render: LogoGiggles },
  { name: 'Flip Flop', render: LogoFlipFlop },
  { name: 'Ethnic Fusion', render: LogoEthnicFusion },
];

export function BrandPartnersSection() {
  return (
    <section
      id="our-brands"
      aria-label="Brand Partners"
      className="w-full py-12 sm:py-16 bg-[var(--warm-50)] border-b border-neutral-200"
    >
      <div className="container-wide">
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-[var(--clr-brand)] block mb-1">
            TRUSTED LABEL PARTNERS
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Our Brand Showcase
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Authentic Sri Lankan and international brands available across our catalog.
          </p>
        </div>

        {/* Clean Logo Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center justify-items-center">
          {BRANDS.map((brand, idx) => {
            const Logo = brand.render;
            return (
              <div
                key={idx}
                className="w-full h-20 rounded-xl bg-white border border-neutral-200/80 flex items-center justify-center p-4 shadow-xs hover:shadow-md transition-all duration-200"
              >
                <Logo />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
