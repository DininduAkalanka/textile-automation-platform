/**
 * Normalizes image URLs so they work reliably across all environments:
 * browser, SSR, and Docker containers.
 *
 * Uploaded product images stored with 'http://localhost:3001/uploads/...' or
 * 'http://127.0.0.1:3001/uploads/...' are converted to root-relative '/uploads/...'
 * paths. This enables Next.js rewrites to forward requests internally to the
 * backend container (http://backend:3001) without encountering loopback ECONNREFUSED.
 */
export function normalizeImageUrl(url?: string | null, fallback = '/images/prod1.png'): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('http://localhost:3001/uploads/')) {
    return trimmed.replace('http://localhost:3001', '');
  }
  if (trimmed.startsWith('http://127.0.0.1:3001/uploads/')) {
    return trimmed.replace('http://127.0.0.1:3001', '');
  }
  return trimmed;
}
