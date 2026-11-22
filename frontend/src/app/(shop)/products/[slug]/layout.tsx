import type { Metadata } from 'next';
import { Suspense, cache } from 'react';

import { getResolvedApiUrl } from '@/lib/api-url';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site-config';

/**
 * Search-engine layer for a product page.
 *
 * The page itself is a client component, so before this every product shared
 * the site's generic title and description, and its canonical URL pointed at
 * the home page: Google was told each product was a copy of "/". This layout
 * gives each product its own title, description, canonical URL, social preview
 * and Product + BreadcrumbList structured data, without changing the page.
 *
 * The API runs on a free host that can be asleep. A slow or failed lookup falls
 * back to plain metadata instead of failing or delaying the page: metadata is
 * streamed to shoppers, and the structured data renders inside Suspense.
 */

type Params = Promise<{ slug: string }>;

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  price: string | number;
  stockQuantity?: number | null;
  images?: string[] | null;
  color?: string | null;
  fabricType?: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
}

const LOOKUP_TIMEOUT_MS = 6000;

/** 'missing' only when the API says so (404); null when it could not answer. */
const getProduct = cache(async (slug: string): Promise<ApiProduct | 'missing' | null> => {
  try {
    const res = await fetch(`${getResolvedApiUrl()}/products/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (res.status === 404) return 'missing';
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: ApiProduct };
    return body.data ?? null;
  } catch {
    return null;
  }
});

const getRating = cache(async (productId: string): Promise<{ average: number; total: number } | null> => {
  try {
    const res = await fetch(`${getResolvedApiUrl()}/reviews/product/${encodeURIComponent(productId)}?limit=1`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { stats?: { average?: number; total?: number } } };
    const stats = body.data?.stats;
    return stats && (stats.total ?? 0) > 0 ? { average: Number(stats.average), total: Number(stats.total) } : null;
  } catch {
    return null;
  }
});

const plainText = (value?: string | null) =>
  (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const lkr = (value: string | number) =>
  `Rs. ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** ~155 characters, cut at a word boundary: what search results show. */
function summary(product: ApiProduct): string {
  const text = `${product.name} – ${lkr(product.price)}. ${plainText(product.description)}`.trim();
  if (text.length <= 155) return text;
  return `${text.slice(0, 152).replace(/\s+\S*$/, '')}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (product === 'missing') {
    // Archived or removed: keep it out of search results (it used to be a
    // "soft 404": a not-found message served with status 200 and indexable).
    return { title: 'Product not found', robots: { index: false, follow: true } };
  }
  if (!product) return { alternates: { canonical: `/products/${slug}` } };

  const path = `/products/${product.slug}`;
  const description = summary(product);
  const image = product.images?.[0] ? absoluteUrl(product.images[0]) : undefined;
  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      siteName: SITE_NAME,
      locale: 'en_LK',
      title: `${product.name} | ${SITE_NAME}`,
      description,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

async function ProductStructuredData({ slug }: { slug: string }) {
  const product = await getProduct(slug);
  if (!product || product === 'missing') return null;

  const url = absoluteUrl(`/products/${product.slug}`);
  const rating = await getRating(product.id);
  const images = (product.images ?? []).slice(0, 6).map((src) => absoluteUrl(src));
  const category = product.category?.name && product.category?.slug ? product.category : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: product.name,
        description: plainText(product.description) || product.name,
        url,
        ...(images.length ? { image: images } : {}),
        ...(product.sku ? { sku: product.sku } : {}),
        brand: { '@type': 'Brand', name: SITE_NAME },
        ...(category ? { category: category.name } : {}),
        ...(product.color ? { color: product.color } : {}),
        ...(product.fabricType ? { material: product.fabricType } : {}),
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'LKR',
          price: Number(product.price).toFixed(2),
          availability:
            (product.stockQuantity ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@id': `${SITE_URL}/#organization` },
          // Matches what the page states: free island-wide delivery in 2–3 business days.
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'LKR' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'LK' },
            deliveryTime: {
              '@type': 'ShippingDeliveryTime',
              handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
              transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 3, unitCode: 'DAY' },
            },
          },
        },
        // Only with real, published reviews (they are shown on the page).
        ...(rating
          ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.total } }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Products', item: absoluteUrl('/products') },
          ...(category
            ? [{
                '@type': 'ListItem',
                position: 3,
                name: category.name,
                item: absoluteUrl(`/products?category=${encodeURIComponent(category.slug ?? '')}`),
              }]
            : []),
          { '@type': 'ListItem', position: category ? 4 : 3, name: product.name, item: url },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so product text can never close the script tag (Next.js JSON-LD guidance).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <ProductStructuredData slug={slug} />
      </Suspense>
      {children}
    </>
  );
}
