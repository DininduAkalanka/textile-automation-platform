import type { BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

export function localUrl(value: string, name: string): string {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be a loopback HTTP(S) URL`);
  }
  return url.href.replace(/\/$/, '');
}

export async function guardNetwork(context: BrowserContext, baseURL: string, apiURL: string) {
  const origins = new Set([
    new URL(localUrl(baseURL, 'baseURL')).origin,
    new URL(localUrl(apiURL, 'apiURL')).origin,
  ]);
  const unexpected: string[] = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (origins.has(url.origin)) return route.continue();

    // The catalog seed includes Shopify photos. Serve the shop's own offline placeholder.
    if (request.method() === 'GET' && request.resourceType() === 'image' && url.origin === 'https://cdn.shopify.com') {
      return route.fulfill({ path: resolve(__dirname, '../../public/images/prod1.png'), contentType: 'image/png' });
    }
    // globals.css imports Google Fonts. The app already defines local font fallbacks.
    if (request.method() === 'GET' && request.resourceType() === 'stylesheet' && url.origin === 'https://fonts.googleapis.com') {
      return route.fulfill({ contentType: 'text/css', body: '/* Use system fonts during local QA. */' });
    }
    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
    await route.abort('blockedbyclient');
  });
  return unexpected;
}
