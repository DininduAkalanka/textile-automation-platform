import {
  AdminReviewsResponse,
  ProductReviewsResponse,
  Review,
  ReviewEligibility,
  ReviewSizeFeedback,
  ReviewSortBy,
  ReviewStatus,
} from '@/types';

import { http, unwrap } from './http';

export interface ReviewFilters {
  page?: number;
  limit?: number;
  sortBy?: ReviewSortBy;
  rating?: number;
  hasPhotos?: boolean;
  verifiedOnly?: boolean;
}

export interface CreateReviewInput {
  productId: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  fabricRating: number;
  colorAccuracyRating: number;
  comfortRating: number;
  sizeFeedback: ReviewSizeFeedback;
  wouldRecommend: boolean;
  images: string[];
}

export type UpdateReviewInput = Partial<
  Omit<CreateReviewInput, 'productId' | 'orderId'>
>;

export interface AdminReviewFilters {
  page?: number;
  limit?: number;
  status?: ReviewStatus;
  productId?: string;
  search?: string;
}

export const reviewsService = {
  getForProduct: (productId: string, filters: ReviewFilters = {}) =>
    unwrap<ProductReviewsResponse>(
      http.get(`/reviews/product/${productId}`, {
        params: {
          page: filters.page,
          limit: filters.limit,
          sortBy: filters.sortBy,
          rating: filters.rating,
          hasPhotos: filters.hasPhotos ? true : undefined,
          verifiedOnly: filters.verifiedOnly ? true : undefined,
        },
      }),
    ),

  getEligibility: (productId: string) =>
    unwrap<ReviewEligibility>(http.get(`/reviews/eligibility/${productId}`)),

  create: (data: CreateReviewInput) =>
    unwrap<Review>(http.post('/reviews', data)),

  update: (id: string, data: UpdateReviewInput) =>
    unwrap<Review>(http.patch(`/reviews/${id}`, data)),

  toggleHelpful: (id: string) =>
    unwrap<{ helpful: boolean; helpfulCount: number }>(
      http.post(`/reviews/${id}/helpful`),
    ),

  report: (id: string, reason: string) =>
    unwrap<{ reported: boolean }>(http.post(`/reviews/${id}/report`, { reason })),

  /**
   * Same disk-upload pipeline as admin product images, just a different,
   * non-admin-gated endpoint — see uploads.controller.ts's
   * ReviewUploadsController.
   */
  uploadReviewImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<{ url: string; filename: string; size: number }>(
      http.post('/uploads/review-image', form, {
        headers: { 'Content-Type': undefined },
      }),
    );
  },

  // ─── Admin ──────────────────────────────────────────────

  listAdmin: (filters: AdminReviewFilters = {}) =>
    unwrap<AdminReviewsResponse>(
      http.get('/reviews/admin/all', {
        params: {
          page: filters.page,
          limit: filters.limit,
          status: filters.status,
          productId: filters.productId,
          search: filters.search || undefined,
        },
      }),
    ),

  listReported: (filters: { page?: number; limit?: number } = {}) =>
    unwrap<AdminReviewsResponse>(
      http.get('/reviews/admin/reported', { params: filters }),
    ),

  hide: (id: string) => unwrap<Review>(http.patch(`/reviews/admin/${id}/hide`)),

  unhide: (id: string) => unwrap<Review>(http.patch(`/reviews/admin/${id}/unhide`)),

  remove: (id: string) =>
    unwrap<{ id: string; deleted: boolean }>(http.delete(`/reviews/admin/${id}`)),
};
