import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

import {
  CLOUDINARY_UPLOAD_FOLDER,
  UPLOADED_FILENAME,
} from '../common/config/exposure';

/**
 * Durable image storage for uploads.
 *
 * The container's own disk is not durable on Render's free tier: it is wiped on
 * every deploy, restart and wake-up after the 15-minute idle spin-down. Product
 * and review photos stored there disappeared (the live shop had three products
 * whose photos returned 404). When the CLOUDINARY_* variables are set, uploads
 * go to Cloudinary instead and the shop stores its permanent https URL. Without
 * them (local development) the disk is used exactly as before.
 *
 * Plain HTTPS calls, no SDK: the signed upload and destroy endpoints are two
 * small requests, and the signing rule is covered by Cloudinary's own published
 * examples in cloudinary.spec.ts.
 */

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret
    ? { cloudName, apiKey, apiSecret }
    : null;
}

/**
 * Cloudinary request signature: the signed parameters sorted by name, joined as
 * name=value with "&", the API secret appended, SHA-1 hex digest. file, api_key,
 * cloud_name and resource_type are never part of the signed string.
 */
export function cloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const serialized = Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join('&');
  return createHash('sha1')
    .update(serialized + apiSecret)
    .digest('hex');
}

/** "<uuid>.jpg" -> "nandana-uploads/<uuid>" (Cloudinary public IDs carry no extension). */
export function cloudinaryPublicId(filename: string): string {
  return `${CLOUDINARY_UPLOAD_FOLDER}/${filename.replace(/\.[^.]+$/, '')}`;
}

const TIMEOUT_MS = 30_000;
const apiUrl = (cfg: CloudinaryConfig, action: 'upload' | 'destroy') =>
  `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/${action}`;

/**
 * Uploads a validated image file. Returns the https URL to store and the
 * filename recorded for it, which ends in the format Cloudinary detected
 * (a ".jpeg" upload comes back as ".jpg"), so it always matches the URL.
 */
export async function uploadToCloudinary(
  filePath: string,
  filename: string,
  cfg: CloudinaryConfig,
): Promise<{ url: string; filename: string }> {
  const publicId = cloudinaryPublicId(filename);
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('file', new Blob([await readFile(filePath)]), filename);
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append(
    'signature',
    cloudinarySignature({ public_id: publicId, timestamp }, cfg.apiSecret),
  );

  const res = await fetch(apiUrl(cfg, 'upload'), {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!res.ok || typeof body.secure_url !== 'string') {
    throw new Error(
      `Cloudinary upload failed (HTTP ${res.status}): ${body.error?.message ?? 'no secure_url in the response'}`,
    );
  }
  const stored = body.secure_url.split('/').pop() ?? '';
  if (!UPLOADED_FILENAME.test(stored)) {
    throw new Error(
      `Cloudinary returned an unexpected URL: ${body.secure_url}`,
    );
  }
  return { url: body.secure_url, filename: stored };
}

/** Deletes an uploaded image. An image that is already gone is not an error. */
export async function deleteFromCloudinary(
  filename: string,
  cfg: CloudinaryConfig,
): Promise<void> {
  const publicId = cloudinaryPublicId(filename);
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(apiUrl(cfg, 'destroy'), {
    method: 'POST',
    body: new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: cfg.apiKey,
      signature: cloudinarySignature(
        { public_id: publicId, timestamp },
        cfg.apiSecret,
      ),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    result?: string;
    error?: { message?: string };
  };
  if (!res.ok || (body.result !== 'ok' && body.result !== 'not found')) {
    throw new Error(
      `Cloudinary delete failed (HTTP ${res.status}): ${body.error?.message ?? body.result ?? 'unknown'}`,
    );
  }
}
