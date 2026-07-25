'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { socialService } from '@/services/social.service';
import { SocialPlatform } from '@/types';

/** The generated caption + platform readiness for a product. */
export function useSocialPreview(productId: string | null) {
  return useQuery({
    queryKey: ['social', 'preview', productId],
    queryFn: () => socialService.preview(productId as string),
    enabled: Boolean(productId),
    staleTime: 0, // always fresh — a product's caption reflects its latest edits
  });
}

/** Attempt to auto-post to the chosen platforms (Facebook/Instagram). */
export function useSharePost() {
  return useMutation({
    mutationFn: ({
      productId,
      platforms,
    }: {
      productId: string;
      platforms: SocialPlatform[];
    }) => socialService.share(productId, platforms),
  });
}
