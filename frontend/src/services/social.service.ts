import { SocialPlatform, SocialPreview, SocialShareResponse } from '@/types';

import { http, unwrap } from './http';

/**
 * Social sharing for a product. The API generates the caption and (when a Meta
 * token is configured) posts to Facebook/Instagram; WhatsApp is a one-tap
 * wa.me link the UI opens directly. Every call is admin-guarded server-side.
 */
export const socialService = {
  preview: (productId: string) =>
    unwrap<SocialPreview>(
      http.get(`/admin/products/${productId}/social/preview`),
    ),

  share: (productId: string, platforms: SocialPlatform[]) =>
    unwrap<SocialShareResponse>(
      http.post(`/admin/products/${productId}/social/post`, { platforms }),
    ),
};
