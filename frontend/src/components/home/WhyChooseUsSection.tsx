'use client';

const PILLARS = [
  {
    num: '01',
    title: 'Textile Expertise',
    subtitle: 'Over 15 Years of Heritage',
    body: 'Founded in 2009, Nandana Textile has cultivated deep roots across Sri Lankan weaving mills and international fabric suppliers, bringing you authentic weaves at honest prices.',
  },
  {
    num: '02',
    title: 'Precision Quality Assurance',
    subtitle: 'Triple-Point Fabric Inspection',
    body: 'Every bolt of cloth and stitched garment undergoes rigorous checks for weave density, seam tensile strength, and wash-cycle color-fastness before dispatch.',
  },
  {
    num: '03',
    title: 'Island-Wide Logistics',
    subtitle: 'Coverage Across All 25 Districts',
    body: 'Whether delivering a single festival saree to Jaffna or a 500-piece uniform consignment to Colombo, our logistics partners ensure prompt, trackable doorstep delivery.',
  },
  {
    num: '04',
    title: 'Enduring Customer Trust',
    subtitle: 'Thousands of Families & Institutions',
    body: 'From generations of schoolchildren outfitted in regulation whites to corporate teams in bespoke blazers, our reputation is built on consistency and care.',
  },
];

export function WhyChooseUsSection() {
  return (
    <section
      id="why-choose-us"
      aria-label="Why Choose Nandana Textile"
      className="w-full py-16 sm:py-20 bg-white border-b border-neutral-200"
    >
      <div className="container-wide">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
            <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
            OUR PHILOSOPHY
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
            Why Nandana Textile?
          </h2>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
            We are more than an apparel storefront. We are an integrated textile powerhouse committed to quality, durability, and customer satisfaction across Sri Lanka.
          </p>
        </div>

        {/* 4 Story Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((p) => (
            <div
              key={p.num}
              className="flex flex-col p-6 rounded-xl border border-neutral-200 bg-[var(--warm-50)] hover:border-neutral-300 hover:bg-white transition-all duration-200"
            >
              <div className="font-mono text-2xl font-bold text-[var(--clr-brand)] mb-3">
                {p.num}
              </div>
              <h3 className="font-serif text-xl font-bold text-neutral-900 mb-1">
                {p.title}
              </h3>
              <p className="font-mono text-[0.65rem] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                {p.subtitle}
              </p>
              <p className="text-xs sm:text-[0.8125rem] text-neutral-600 leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
