import { Metadata } from 'next';
import {
  HeroSection,
  CategoryDiscovery,
  NewArrivalsSection,
  WomensWearSection,
  EditorialCampaign,
  MensWearSection,
  BestSellersSection,
  UniformSolutionsSection,
  ShopTheLookSection,
  FabricShowcaseSection,
  WhyChooseUsSection,
  BrandPartnersSection,
} from '@/components/home';

export const metadata: Metadata = {
  title: 'Nandana Textile | Premium Fabrics, Apparel & Institutional Uniforms in Sri Lanka',
  description:
    'Sri Lanka’s premier textile destination since 2009. Shop authentic fashion, luxury sarees, custom tailoring fabrics, and institutional school & corporate uniforms with island-wide delivery.',
  keywords: [
    'Textiles Sri Lanka',
    'School Uniforms Colombo',
    'Corporate Uniforms Sri Lanka',
    'Cotton Fabrics Sri Lanka',
    'Sarees Colombo',
    'Nandana Textile',
    'Bulk Garment Orders Sri Lanka',
  ],
  openGraph: {
    title: 'Nandana Textile | Premium Fabrics, Apparel & Institutional Uniforms',
    description:
      'Shop authentic fashion, luxury sarees, tailoring fabrics, and institutional uniforms with reliable island-wide delivery across all 25 districts.',
    url: 'https://nandanatextile.lk',
    siteName: 'Nandana Textile',
    images: [
      {
        url: '/images/hero/hero-banner-web2.jpg',
        width: 1920,
        height: 600,
        alt: 'Nandana Textile Collection',
      },
    ],
    locale: 'en_LK',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://nandanatextile.lk/#organization',
      name: 'Nandana Textile',
      url: 'https://nandanatextile.lk',
      description: 'Sri Lanka’s premier textile, apparel, and institutional uniform specialist since 2009.',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+94-71-708-8445',
        contactType: 'customer service',
        areaServed: 'LK',
        availableLanguage: ['English', 'Sinhala', 'Tamil'],
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'LK',
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://nandanatextile.lk/#website',
      url: 'https://nandanatextile.lk',
      name: 'Nandana Textile',
      publisher: {
        '@id': 'https://nandanatextile.lk/#organization',
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://nandanatextile.lk/products?search={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="homepage-container" style={{ width: '100%', overflowX: 'hidden' }}>
        {/* 1. Hero Section: High-impact editorial commerce slider */}
        <HeroSection />

        {/* 2. Live New Arrivals: Dynamic catalog grid with quick action triggers */}
        <NewArrivalsSection />

        {/* 3. Five-Pillar Category Discovery: Women, Men, Teenagers, Uniforms, Fabrics */}
        <CategoryDiscovery />

        {/* 4. Women's Wear Showcase: Thilakawardhana-style dedicated department rail */}
        <WomensWearSection />

        {/* 5. Editorial Craftsmanship Campaign: Full-bleed lifestyle storytelling banner */}
        <EditorialCampaign />

        {/* 6. Men's Wear Showcase: Thilakawardhana-style dedicated department rail */}
        <MensWearSection />

        {/* 8. Best Sellers & Customer Favorites: Highest-rated catalog products */}
        <BestSellersSection />

        {/* 7. Institutional & Uniform Solutions: Sector tabs & bulk procurement quote RFQ */}
        <UniformSolutionsSection />

        {/* 8. Curated Ensemble: Shop The Look 3-piece bundle with 1-click cart add */}
        <ShopTheLookSection />

        {/* 9. Material & Fabric Showcase: Tactile textile exploration with GSM & weave specs */}
        <FabricShowcaseSection />

        {/* 10. Why Choose Us: 15+ years heritage, triple-point QC, 25-district reach */}
        <WhyChooseUsSection />

        {/* 11. Featured Brand Partners: Restrained, authentic SVG brand identities */}
        <BrandPartnersSection />
      </div>
    </>
  );
}
