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

/** Cloudinary folder that holds the shop's uploads (see uploads/cloudinary.ts). */
export const CLOUDINARY_UPLOAD_FOLDER = 'nandana-uploads';

/**
 * An image URL the shop issued, as { filename, canonical url }, or null.
 *
 * Two shapes are recognised:
 * - /uploads/<uuid>.<ext> on any origin (disk storage), canonicalised to this
 *   API's own upload URL;
 * - https://res.cloudinary.com/<our cloud>/image/upload/[v<n>/]nandana-uploads/<uuid>.<ext>,
 *   only for the configured cloud and folder, so a review cannot point at an
 *   image in someone else's account.
 */
export function uploadedImageRef(
  url: string,
): { filename: string; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://placeholder.invalid');
  } catch {
    return null;
  }
  const local = /^\/uploads\/([^/]+)$/.exec(parsed.pathname);
  if (local && UPLOADED_FILENAME.test(local[1])) {
    return { filename: local[1], url: publicUploadUrl(local[1]) };
  }
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (
    cloud &&
    parsed.protocol === 'https:' &&
    parsed.hostname === 'res.cloudinary.com'
  ) {
    const m = /^\/([^/]+)\/image\/upload\/(?:v(\d+)\/)?([^/]+)\/([^/]+)$/.exec(
      parsed.pathname,
    );
    if (
      m &&
      m[1] === cloud &&
      m[3] === CLOUDINARY_UPLOAD_FOLDER &&
      UPLOADED_FILENAME.test(m[4])
    ) {
      const version = m[2] ? `v${m[2]}/` : '';
      return {
        filename: m[4],
        url: `https://res.cloudinary.com/${cloud}/image/upload/${version}${CLOUDINARY_UPLOAD_FOLDER}/${m[4]}`,
      };
    }
  }
  return null;
}

/** The upload filename inside an image URL the shop issued, or null. */
export function uploadedFilenameFrom(url: string): string | null {
  return uploadedImageRef(url)?.filename ?? null;
}
