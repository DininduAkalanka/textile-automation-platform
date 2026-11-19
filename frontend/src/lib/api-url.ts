/**
 * The ONE place that decides which API a page talks to (QA P1-10).
 *
 * Before this file there were two copies of the rule (lib/api.ts and
 * services/http.ts) that disagreed, plus an axios interceptor that rewrote any
 * localhost URL to the live Render API whenever the page was not on localhost.
 * The result: opening the shop from a LAN IP, a staging host or a Vercel preview
 * link silently created REAL orders in production.
 *
 * The rule now, in order:
 *   1. NEXT_PUBLIC_API_URL, when the build set it. Always wins.
 *   2. A real production deployment (a known production host, or a build Vercel
 *      marked as production) uses the live API.
 *   3. Everything else uses the API on the SAME host, port 3001 — never the live
 *      API. A misconfigured preview fails visibly instead of writing to production.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally: Next.js inlines those
 * references at build time and does not inline dynamic lookups.
 */

export const PRODUCTION_API_URL =
  'https://textile-automation-platform.onrender.com/api/v1';
export const LOCAL_API_URL = 'http://localhost:3001/api/v1';

/** Hosts that serve the live storefront. Extra hosts: NEXT_PUBLIC_PRODUCTION_HOSTS (comma-separated). */
const PRODUCTION_HOSTS = new Set<string>([
  'textile-automation-platform.vercel.app',
  'nandanatextile.lk',
  'www.nandanatextile.lk',
  ...(process.env.NEXT_PUBLIC_PRODUCTION_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
]);

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function getResolvedApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (isProductionHost(hostname)) return PRODUCTION_API_URL;
    // Vercel exposes the deployment type to the browser bundle. Only a
    // production deployment (custom domain included) may use the live API —
    // preview deployments fall through to the same-host default below.
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
      return PRODUCTION_API_URL;
    }
    return `${protocol}//${hostname}:3001/api/v1`;
  }

  // Server side (SSR, sitemap). Only a production deployment uses the live API.
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_API_URL;
  return LOCAL_API_URL;
}
