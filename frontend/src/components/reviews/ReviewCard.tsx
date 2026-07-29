'use client';

import { useState } from 'react';
import { Flag, Pencil, ShieldCheck, ThumbsUp } from 'lucide-react';

import { Review } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useReportReview, useToggleHelpful } from '@/hooks/use-reviews';

import { ReviewForm } from './ReviewForm';
import { StarRating } from './StarRating';

const SIZE_FEEDBACK_LABEL: Record<Review['sizeFeedback'], string> = {
  RUNS_SMALL: 'Runs Small',
  TRUE_TO_SIZE: 'True to Size',
  RUNS_LARGE: 'Runs Large',
};

function reviewerName(review: Review) {
  if (!review.user) return 'A customer';
  const lastInitial = review.user.lastName?.[0];
  return lastInitial ? `${review.user.firstName} ${lastInitial}.` : review.user.firstName;
}

function initials(review: Review) {
  if (!review.user) return '?';
  const first = review.user.firstName?.[0] ?? '';
  const last = review.user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

const STAT_CHIP = 'rounded-full border border-neutral-200 px-3 py-1 text-neutral-600';

export function ReviewCard({ review, productId }: { review: Review; productId: string }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { user } = useAuthStore();
  const isOwnReview = user?.id === review.userId;

  const toggleHelpful = useToggleHelpful(productId);
  const reportReview = useReportReview();

  const submitReport = () => {
    if (reason.trim().length < 3) return;
    reportReview.mutate(
      { id: review.id, reason: reason.trim() },
      { onSuccess: () => setReporting(false) },
    );
    setReason('');
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
            {initials(review)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-900">{reviewerName(review)}</span>
              {review.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Verified Purchase
                </span>
              )}
            </div>
            <time className="text-xs text-neutral-500" dateTime={review.createdAt}>
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
        </div>
        <StarRating value={review.rating} size="sm" className="shrink-0" />
      </div>

      <h4 className="mt-4 text-base font-semibold text-neutral-900">{review.title}</h4>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
        {review.comment}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-medium">
        <span className={STAT_CHIP}>{SIZE_FEEDBACK_LABEL[review.sizeFeedback]}</span>
        <span className={STAT_CHIP}>Fabric {review.fabricRating}/5</span>
        <span className={STAT_CHIP}>Color accuracy {review.colorAccuracyRating}/5</span>
        <span className={STAT_CHIP}>Comfort {review.comfortRating}/5</span>
        <span
          className={cn(
            'rounded-full px-3 py-1',
            review.wouldRecommend
              ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
              : 'border border-neutral-200 text-neutral-500',
          )}
        >
          {review.wouldRecommend ? '✓ Recommends this product' : 'Does not recommend'}
        </span>
      </div>

      {review.images.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {review.images.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxUrl(url)}
              className="h-20 w-20 overflow-hidden rounded-xl border border-neutral-200 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Customer photo" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4 text-sm">
        <button
          type="button"
          onClick={() => toggleHelpful.mutate(review.id)}
          disabled={toggleHelpful.isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          Helpful{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ''}
        </button>
        {isOwnReview ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit your review
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReporting((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Report
          </button>
        )}
      </div>

      {editing && (
        <ReviewForm
          mode="edit"
          review={review}
          productId={productId}
          onClose={() => setEditing(false)}
        />
      )}

      {reporting && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:flex-row">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reporting this review?"
            className="flex-1 rounded-[10px] border border-neutral-300 bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            type="button"
            onClick={submitReport}
            disabled={reason.trim().length < 3 || reportReview.isPending}
            className="rounded-[10px] bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Customer photo, enlarged"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
