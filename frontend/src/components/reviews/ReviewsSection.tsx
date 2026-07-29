'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useProductReviews } from '@/hooks/use-reviews';

import { RatingSummary } from './RatingSummary';
import { ReviewCard } from './ReviewCard';
import { ReviewFilters, ReviewFilterState } from './ReviewFilters';
import { ReviewsEmptyState } from './ReviewsEmptyState';
import { ReviewsSkeleton } from './ReviewsSkeleton';
import { WriteReviewCta } from './WriteReviewCta';

const DEFAULT_FILTERS: ReviewFilterState = {
  sortBy: 'recent',
  rating: undefined,
  hasPhotos: false,
  verifiedOnly: false,
};

export function ReviewsSection({ productId }: { productId: string }) {
  const [filters, setFilters] = useState<ReviewFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProductReviews(productId, {
    page,
    sortBy: filters.sortBy,
    rating: filters.rating,
    hasPhotos: filters.hasPhotos,
    verifiedOnly: filters.verifiedOnly,
  });

  const handleFiltersChange = (next: ReviewFilterState) => {
    setFilters(next);
    setPage(1);
  };

  const isFiltered = Boolean(filters.rating || filters.hasPhotos || filters.verifiedOnly);

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        Couldn't load reviews right now — please try again shortly.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12">
        {/* Summary + CTA — sticky on desktop, first in flow on mobile. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Customer Reviews</h2>

            <div className="mt-5">
              {data ? (
                <RatingSummary stats={data.stats} />
              ) : (
                <div className="space-y-3">
                  <div className="h-12 w-24 animate-pulse rounded-lg bg-neutral-200" />
                  <div className="h-20 w-full animate-pulse rounded-lg bg-neutral-100" />
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-6">
              <WriteReviewCta productId={productId} />
            </div>
          </div>
        </aside>

        {/* Filters + review list */}
        <div className="min-w-0">
          {isLoading || !data ? (
            <ReviewsSkeleton />
          ) : (
            <>
              {data.reviews.length > 0 && (
                <ReviewFilters value={filters} onChange={handleFiltersChange} />
              )}

              {data.reviews.length === 0 ? (
                <ReviewsEmptyState filtered={isFiltered} />
              ) : (
                <div className="mt-5 flex flex-col gap-4">
                  {data.reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} productId={productId} />
                  ))}
                </div>
              )}

              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-8">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Previous
                  </button>
                  <span className="text-sm text-neutral-500">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page >= data.pagination.totalPages}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
