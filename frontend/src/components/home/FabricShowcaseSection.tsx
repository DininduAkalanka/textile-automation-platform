'use client';

import Link from 'next/link';

interface FabricPillar {
  name: string;
  type: string;
  weave: string;
  gsm: string;
  properties: string[];
  description: string;
  href: string;
}

const FABRICS: FabricPillar[] = [
  {
    name: 'Pure Handloom Cotton',
    type: '100% Natural Organic Cotton',
    weave: 'Traditional Loom Plain Weave',
    gsm: '160–180 GSM',
    properties: ['Breathable', 'Ultra-Soft', 'Eco-Dyed', 'Cooling'],
    description: 'Heritage handwoven cotton sourced directly from Sri Lankan artisanal loom societies. Ideal for sarees, casual shirting, and warm tropical weather.',
    href: '/products?category=fabrics&material=cotton',
  },
  {
    name: 'Natural Washed Linen',
    type: 'Pure Flax Fiber',
    weave: 'Slub Textured Basket Weave',
    gsm: '175–210 GSM',
    properties: ['Temperature Regulating', 'High Wicking', 'Crisp Drape'],
    description: 'Lightweight and effortlessly textured. Crafted to soften naturally with each wash, offering relaxed luxury for executive casuals.',
    href: '/products?category=fabrics&material=linen',
  },
  {
    name: 'Institutional Uniform Drill',
    type: 'Poly-Cotton Blended Twill',
    weave: '2/1 Heavy-Duty Diagonal Twill',
    gsm: '220–260 GSM',
    properties: ['High Tensile Strength', 'Crease Resistant', 'Color-Fast', 'Non-Shrink'],
    description: 'Ministry and institutional standard-compliant fabric. Built to endure rigorous daily wash cycles for school uniforms, nurse tunics, and industrial wear.',
    href: '/products?category=uniforms',
  },
  {
    name: 'Celebration Mulberry Silk',
    type: 'Natural Filament Silk Blend',
    weave: 'Fine Jacquard Brocade',
    gsm: '90–120 GSM',
    properties: ['Lustrous Finish', 'Fluid Drape', 'Vibrant Color Hold'],
    description: 'Woven for milestone ceremonies, weddings, and formal festivals. Features intricate zari border motifs with unmatched sheen.',
    href: '/products?category=women&sub=sarees',
  },
];

export function FabricShowcaseSection() {
  return (
    <section
      id="fabric-collection"
      aria-label="Fabric Collection & Material Mastery"
      className="w-full py-16 sm:py-20 bg-[var(--warm-50)] border-b border-neutral-200"
    >
      <div className="container-wide">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10 pb-3 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] font-bold tracking-[0.18em] uppercase text-[var(--clr-brand)] mb-1">
              <span className="w-5 h-[1.5px] bg-[var(--clr-brand)] inline-block" />
              MATERIAL MASTERY
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900">
              The Fabric Collection
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-xl">
              From tropical breathable handlooms to certified heavy-duty uniform drills — every yard is engineered for durability.
            </p>
          </div>

          <Link
            href="/products?category=fabrics"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--clr-brand)] hover:text-[var(--crimson-700)] transition-colors group self-start sm:self-end"
          >
            <span>Explore All Textiles</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Fabric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FABRICS.map((fabric, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between bg-white rounded-xl p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-neutral-500">
                    {fabric.type}
                  </span>
                  <span className="font-mono text-[0.625rem] font-semibold text-[var(--clr-brand)] bg-[var(--clr-brand-tint)] px-2 py-0.5 rounded">
                    {fabric.gsm}
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-neutral-900 leading-snug mb-2">
                  {fabric.name}
                </h3>

                <p className="text-xs text-neutral-600 leading-relaxed mb-5">
                  {fabric.description}
                </p>

                {/* Tactile Characteristics Badges */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {fabric.properties.map((prop, pIdx) => (
                    <span
                      key={pIdx}
                      className="px-2 py-0.5 text-[0.625rem] font-mono font-medium text-neutral-700 bg-neutral-100 rounded border border-neutral-200"
                    >
                      {prop}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={fabric.href}
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--clr-brand)] hover:text-red-700 pt-3 border-t border-neutral-100 transition-colors"
              >
                <span>View Products in this Fabric</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
