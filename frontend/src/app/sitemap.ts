import { MetadataRoute } from 'next';
import { getResolvedApiUrl } from '@/lib/api-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nandanatextile.lk';
  // Shared rule (QA P1-10): only a production deployment reads the live API.
  const apiUrl = getResolvedApiUrl();

  // Base static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // Customer-information pages.
    ...['/contact', '/returns-exchange', '/shipping', '/size-guide', '/privacy', '/terms'].map(
      (path): MetadataRoute.Sitemap[number] => ({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ),
  ];

  // Dynamic product routes
  // During Vercel builds, if NEXT_PUBLIC_API_URL is missing or points to localhost, safely skip dynamic fetch
  const isLocalhost = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
  if (process.env.VERCEL && isLocalhost) {
    return staticRoutes;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${apiUrl}/products?limit=100`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const products = data.data?.products || data.products || [];

      const productRoutes: MetadataRoute.Sitemap = products.map((p: { slug?: string; id: string; updatedAt?: string }) => ({
        url: `${baseUrl}/products/${p.slug || p.id}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));

      return [...staticRoutes, ...productRoutes];
    }
  } catch {
    console.warn('Sitemap notice: dynamic products not fetched during build, using static routes.');
  }

  return staticRoutes;
}
