import { http, unwrap } from './http';

export interface UploadedImage {
  url: string;
  filename: string;
  size: number;
}

/** Client-side guard rails, mirrored by the API (doc 09 §10). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Uploads a product image and returns its public URL.
 *
 * Content-Type is explicitly cleared so the browser sets
 * `multipart/form-data; boundary=…` itself — the shared axios instance defaults
 * to application/json, which would make the server reject the upload.
 */
export const uploadsService = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);

    return unwrap<UploadedImage>(
      http.post('/admin/uploads/image', form, {
        headers: { 'Content-Type': undefined },
      }),
    );
  },
};
