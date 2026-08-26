import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nandanatextile.lk';

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
