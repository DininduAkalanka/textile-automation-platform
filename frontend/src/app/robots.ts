import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  // The live www address (the bare domain redirects there).
  const baseUrl = SITE_URL;

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/products',
          '/products/*',
          '/returns-exchange',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/worker',
          '/worker/*',
          '/account',
          '/account/*',
          '/checkout',
          '/cart',
          '/payment/*',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
