/**
 * What the API exposes to the outside world (QA remediation, Group 1).
 */

/**
 * QA P2-11: the Swagger UI used to be ON unless someone remembered to set
 * SWAGGER_ENABLED=false — so production published a full map of every route,
 * DTO and admin endpoint. It is now OFF in production unless explicitly turned
 * on, and ON everywhere else (local development, CI).
 */
export function swaggerEnabled(): boolean {
  const raw = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

interface RequestLike {
  protocol: string;
  get(name: string): string | undefined;
}

/**
 * QA P2-15: the origin that uploaded-image URLs are built on.
 *
 * It used to come from the request's Host header whenever PUBLIC_API_URL was
 * unset, and the Host header is whatever the client sends — so an attacker
 * could make the API hand back (and the shop then store) image links pointing
 * at their own server. Now, in order:
 *   1. PUBLIC_API_URL, when configured;
 *   2. RENDER_EXTERNAL_URL, which Render sets automatically for the service;
 *   3. outside production only, the request's own host (local development);
 *   4. otherwise "" — a root-relative /uploads/<file> path, which the
 *      storefront serves through its /uploads rewrite.
 */
export function uploadsBaseUrl(req?: RequestLike): string {
  const configured =
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim();
  if (configured) {
    const base = configured.replace(/\/+$/, '');
    // A bare host ("api.example.com") would make every image URL relative.
    return /^https?:\/\//i.test(base) ? base : `https://${base}`;
  }
  if (req && process.env.NODE_ENV !== 'production') {
    return `${req.protocol}://${req.get('host')}`;
  }
  return '';
}

export function publicUploadUrl(filename: string, req?: RequestLike): string {
  return `${uploadsBaseUrl(req)}/uploads/${filename}`;
}

/** Filenames the upload endpoint issues: a random UUID and a safe image extension. */
export const UPLOADED_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/;

/**
 * The upload filename inside an image URL the shop issued, or null.
 * Accepts absolute (any origin) and root-relative forms; only the
 * /uploads/<uuid>.<ext> shape is recognised.
 */
export function uploadedFilenameFrom(url: string): string | null {
  let path: string;
  try {
    path = new URL(url, 'http://placeholder.invalid').pathname;
  } catch {
    return null;
  }
  const match = /^\/uploads\/([^/]+)$/.exec(path);
  return match && UPLOADED_FILENAME.test(match[1]) ? match[1] : null;
}
