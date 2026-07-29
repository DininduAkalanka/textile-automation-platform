'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AdminReviewFilters,
  CreateReviewInput,
  ReviewFilters,
  UpdateReviewInput,
  reviewsService,
} from '@/services/reviews.service';

export const reviewKeys = {
  all: ['reviews'] as const,
  product: (productId: string, filters: ReviewFilters) =>
    ['reviews', 'product', productId, filters] as const,
  eligibility: (productId: string) => ['reviews', 'eligibility', productId] as const,
  admin: (filters: AdminReviewFilters) => ['reviews', 'admin', filters] as const,
  reported: (filters: { page?: number; limit?: number }) =>
    ['reviews', 'admin', 'reported', filters] as const,
};

export function useProductReviews(productId: string, filters: ReviewFilters = {}) {
  return useQuery({
    queryKey: reviewKeys.product(productId, filters),
    queryFn: () => reviewsService.getForProduct(productId, filters),
    enabled: Boolean(productId),
    placeholderData: (previous) => previous, // no flicker when paging/sorting/filtering
  });
}

/** Drives the "Write a Review" CTA. Silently unauthenticated-safe: callers
 *  gate this hook on `isAuthenticated` since there is nothing to check for a
 *  logged-out visitor (the CTA just doesn't render). */
export function useReviewEligibility(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: reviewKeys.eligibility(productId),
    queryFn: () => reviewsService.getEligibility(productId),
    enabled: Boolean(productId) && enabled,
    staleTime: 30 * 1000,
  });
}

function useInvalidateProductReviews(productId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', 'product', productId] });
    void queryClient.invalidateQueries({ queryKey: reviewKeys.eligibility(productId) });
  };
}

export function useCreateReview(productId: string) {
  const invalidate = useInvalidateProductReviews(productId);

  return useMutation({
    mutationFn: (data: CreateReviewInput) => reviewsService.create(data),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateReview(productId: string) {
  const invalidate = useInvalidateProductReviews(productId);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReviewInput }) =>
      reviewsService.update(id, data),
    onSuccess: () => {
      toast.success('Review updated');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleHelpful(productId: string) {
  const invalidate = useInvalidateProductReviews(productId);

  return useMutation({
    mutationFn: (id: string) => reviewsService.toggleHelpful(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useReportReview() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reviewsService.report(id, reason),
    onSuccess: () => toast.success('Thanks — our team will take a look.'),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUploadReviewImage() {
  return useMutation({
    mutationFn: (file: File) => reviewsService.uploadReviewImage(file),
    onError: (error: Error) => toast.error(error.message),
  });
}

// ─── Admin ──────────────────────────────────────────────

export function useAdminReviews(filters: AdminReviewFilters) {
  return useQuery({
    queryKey: reviewKeys.admin(filters),
    queryFn: () => reviewsService.listAdmin(filters),
    placeholderData: (previous) => previous,
  });
}

export function useReportedReviews(filters: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: reviewKeys.reported(filters),
    queryFn: () => reviewsService.listReported(filters),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateAdminReviews() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
}

export function useHideReview() {
  const invalidate = useInvalidateAdminReviews();

  return useMutation({
    mutationFn: (id: string) => reviewsService.hide(id),
    onSuccess: () => {
      toast.success('Review hidden');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUnhideReview() {
  const invalidate = useInvalidateAdminReviews();

  return useMutation({
    mutationFn: (id: string) => reviewsService.unhide(id),
    onSuccess: () => {
      toast.success('Review restored');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidateAdminReviews();

  return useMutation({
    mutationFn: (id: string) => reviewsService.remove(id),
    onSuccess: () => {
      toast.success('Review deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
