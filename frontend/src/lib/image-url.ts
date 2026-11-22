/**
 * Normalizes image URLs so they work reliably across all environments:
 * browser, SSR, and Docker containers.
 *
 * Uploaded product images stored with 'http://localhost:3001/uploads/...' or
 * 'http://127.0.0.1:3001/uploads/...' are converted to root-relative '/uploads/...'
 * paths. This enables Next.js rewrites to forward requests internally to the
 * backend container (http://backend:3001) without encountering loopback ECONNREFUSED.
 */
const SEED_IMAGE_MAP: Record<string, string> = {
  '/images/products/acc-belt.png': '/images/products/men-formal-trouser.jpg',
  '/images/products/acc-tie.png': '/images/products/uniform-shirt.png',
  '/images/products/custom-shirt.png': '/images/products/men-shirt.png',
  '/images/products/fabric-silk.png': '/images/products/women-silk-saree.jpg',
  '/images/products/fabric-poly.png': '/images/products/uniform-blazer.png',
  '/images/products/fabric-linen.png': '/images/products/women-linen-top.jpg',
  '/images/products/fabric-poplin.png': '/images/products/men-linen-shirt.jpg',
  '/images/products/fabric-cotton.png': '/images/products/women-cotton-saree.jpg',
};

export function normalizeImageUrl(url?: string | null, fallback = '/images/prod1.png'): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }
  const trimmed = url.trim();
  if (SEED_IMAGE_MAP[trimmed]) {
    return SEED_IMAGE_MAP[trimmed];
  }
  if (trimmed.startsWith('http://localhost:3001/uploads/')) {
    return trimmed.replace('http://localhost:3001', '');
  }
  if (trimmed.startsWith('http://127.0.0.1:3001/uploads/')) {
    return trimmed.replace('http://127.0.0.1:3001', '');
  }
  // Uploaded photos are stored on Cloudinary at their original size (up to
  // 2 MB). Asking for f_auto,q_auto serves WebP/AVIF at an automatic quality —
  // usually a fraction of the bytes, which matters for page speed (a search
  // ranking factor). Display only: the stored URL is unchanged, and a URL that
  // already carries a transformation is left alone.
  if (CLOUDINARY_UPLOAD.test(trimmed)) {
    return trimmed.replace(CLOUDINARY_UPLOAD, '$1f_auto,q_auto/');
  }
  return trimmed;
}

/** "https://res.cloudinary.com/<cloud>/image/upload/" not already followed by a transformation. */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?![a-z]{1,3}_[^/]*\/)/;
