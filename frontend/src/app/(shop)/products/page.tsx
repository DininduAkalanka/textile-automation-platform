import type { Metadata } from 'next';

import ProductsPage from './products-page-client';

/**
 * Server entry for the catalogue: only metadata lives here, the page itself is
 * the client component in products-page-client.tsx.
 *
 * Category and collection pages ("?category=women") are real landing pages, so
 * each gets its own title, description and self-canonical URL. Search, sort,
 * price and other filtered views are endless variations of the same products:
 * they stay out of search results (noindex) while their links are still followed.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LANDING: Record<string, { title: string; description: string }> = {
  'new-arrivals': {
    title: 'New Arrivals',
    description: 'The latest sarees, shirts, dress materials and uniforms at Nandana Textile, delivered island-wide across Sri Lanka.',
  },
  women: {
    title: "Women's Collection",
    description: 'Sarees, kurtha tops, office wear and dress materials for women. Shop online at Nandana Textile with island-wide delivery.',
  },
  men: {
    title: "Men's Collection",
    description: 'Shirts, trousers and office wear for men. Shop online at Nandana Textile with island-wide delivery across Sri Lanka.',
  },
  teenagers: {
    title: 'Teenagers Collection',
    description: 'Clothing for teenagers at Nandana Textile, with island-wide delivery across Sri Lanka.',
  },
  uniforms: {
    title: 'Uniforms & Workwear',
    description: 'School, corporate, healthcare and industrial uniforms, ready-made or tailored to measurement. Nandana Textile, Sri Lanka.',
  },
  'school-uniforms': {
    title: 'School Uniforms',
    description: 'School uniform shirts, shorts, trousers and frocks in standard sizes or tailored to your child’s measurements. Island-wide delivery.',
  },
  'corporate-uniforms': {
    title: 'Corporate Uniforms & Workwear',
    description: 'Corporate and office uniforms for staff, in standard sizes or tailored. Bulk orders welcome. Nandana Textile, Sri Lanka.',
  },
  'healthcare-uniforms': {
    title: 'Healthcare & Hospitality Uniforms',
    description: 'Uniforms for hospitals, clinics, hotels and restaurants, tailored to your team. Nandana Textile, Sri Lanka.',
  },
  'industrial-uniforms': {
    title: 'Industrial & Safety Workwear',
    description: 'Durable industrial and safety workwear for factories and field teams. Nandana Textile, Sri Lanka.',
  },
};

/** Anything beyond the landing keys makes the URL a filtered variant. */
const LANDING_KEYS = new Set(['category', 'collection', 'sub']);

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
const titleCase = (slug: string) =>
  slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const category = first(params.category);
  const collection = first(params.collection);
  const sub = first(params.sub);
  const filtered = Object.entries(params).some(([key, value]) => !LANDING_KEYS.has(key) && first(value));

  const key = sub || category || collection;
  const known = LANDING[key];
  const title = known?.title ?? (key ? titleCase(key) : 'Shop All Products');
  const description =
    known?.description ??
    (key
      ? `${title} at Nandana Textile. Shop online with island-wide delivery across Sri Lanka.`
      : 'Shop sarees, shirts, dress materials and school, corporate and healthcare uniforms online at Nandana Textile, with island-wide delivery.');

  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (collection) query.set('collection', collection);
  if (sub) query.set('sub', sub);
  const qs = query.toString();
  const canonical = qs ? `/products?${qs}` : '/products';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | Nandana Textile`, description, url: canonical, type: 'website' },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function Page() {
  return <ProductsPage />;
}
