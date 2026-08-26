'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewEligibility } from '@/hooks/use-reviews';

import { ReviewForm } from './ReviewForm';

/**
 * The eligibility gate the whole feature hinges on: a customer only ever
 * sees "Write a Review" once ReviewsService.checkEligibility (server-side)
 * confirms a DELIVERED, unreviewed order for this product. Every other state
 * either hides the CTA entirely or explains why.
 */
export function WriteReviewCta({ productId }: { productId: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { data: eligibility, isLoading } = useReviewEligibility(productId, isAuthenticated);

  if (!isAuthenticated) {
    return (
      <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
          Sign in
        </Link>{' '}
        to write a review.
      </p>
    );
  }

  if (isLoading || !eligibility) {
    return <div className="h-11 w-full animate-pulse rounded-[10px] bg-neutral-200" />;
  }

  if (eligibility.eligible) {
    return (
      <>
        <Button onClick={() => setFormOpen(true)} size="lg" className="w-full">
          Write a Review
        </Button>
        {formOpen && (
          <ReviewForm
            mode="create"
            productId={productId}
            orderId={eligibility.orderId}
            onClose={() => setFormOpen(false)}
          />
        )}
      </>
    );
  }

  if (eligibility.reason === 'NOT_DELIVERED') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <span>You can review this product after it has been delivered.</span>
      </div>
    );
  }

  if (eligibility.reason === 'ALREADY_REVIEWED') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>You've already reviewed this product. Find your review below to edit it.</span>
      </div>
    );
  }

  // NOT_PURCHASED: hide the CTA entirely, per spec.
  return null;
}
