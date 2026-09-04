import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nandanatextile.lk';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
    {
      url: `${baseUrl}/returns-exchange`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
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
