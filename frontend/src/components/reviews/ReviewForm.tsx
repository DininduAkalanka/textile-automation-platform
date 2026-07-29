'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/services/uploads.service';
import { Review, ReviewSizeFeedback } from '@/types';
import { cn } from '@/lib/utils';
import {
  useCreateReview,
  useUpdateReview,
  useUploadReviewImage,
} from '@/hooks/use-reviews';

import { StarRating } from './StarRating';

const SIZE_OPTIONS: { value: ReviewSizeFeedback; label: string }[] = [
  { value: 'RUNS_SMALL', label: 'Runs Small' },
  { value: 'TRUE_TO_SIZE', label: 'True to Size' },
  { value: 'RUNS_LARGE', label: 'Runs Large' },
];

const MAX_IMAGES = 4;

interface FormState {
  rating: number;
  title: string;
  comment: string;
  fabricRating: number;
  colorAccuracyRating: number;
  comfortRating: number;
  sizeFeedback: ReviewSizeFeedback | null;
  wouldRecommend: boolean | null;
  images: string[];
}

function initialState(review?: Review): FormState {
  if (!review) {
    return {
      rating: 0,
      title: '',
      comment: '',
      fabricRating: 0,
      colorAccuracyRating: 0,
      comfortRating: 0,
      sizeFeedback: null,
      wouldRecommend: null,
      images: [],
    };
  }
  return {
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    fabricRating: review.fabricRating,
    colorAccuracyRating: review.colorAccuracyRating,
    comfortRating: review.comfortRating,
    sizeFeedback: review.sizeFeedback,
    wouldRecommend: review.wouldRecommend,
    images: review.images,
  };
}

function validate(state: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!state.rating) errors.rating = 'Select an overall rating';
  if (state.title.trim().length < 3) errors.title = 'Title must be at least 3 characters';
  if (state.title.length > 120) errors.title = 'Title must be under 120 characters';
  if (state.comment.trim().length < 10) errors.comment = 'Tell us a bit more (at least 10 characters)';
  if (state.comment.length > 2000) errors.comment = 'Comment must be under 2000 characters';
  if (!state.fabricRating) errors.fabricRating = 'Rate the fabric quality';
  if (!state.colorAccuracyRating) errors.colorAccuracyRating = 'Rate the color accuracy';
  if (!state.comfortRating) errors.comfortRating = 'Rate the comfort';
  if (!state.sizeFeedback) errors.sizeFeedback = 'Select how the size fits';
  if (state.wouldRecommend === null) errors.wouldRecommend = 'Let us know if you’d recommend it';
  return errors;
}

type ReviewFormProps =
  | { mode: 'create'; productId: string; orderId: string; onClose: () => void }
  | { mode: 'edit'; review: Review; productId: string; onClose: () => void };

export function ReviewForm(props: ReviewFormProps) {
  const [state, setState] = useState<FormState>(
    props.mode === 'edit' ? initialState(props.review) : initialState(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [uploadError, setUploadError] = useState('');

  const createReview = useCreateReview(props.productId);
  const updateReview = useUpdateReview(props.productId);
  const uploadImage = useUploadReviewImage();

  const submitting =
    props.mode === 'create' ? createReview.isPending : updateReview.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError('');

    const remaining = MAX_IMAGES - state.images.length;
    if (remaining <= 0) {
      setUploadError(`You can attach up to ${MAX_IMAGES} photos.`);
      return;
    }

    for (const file of Array.from(files).slice(0, remaining)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setUploadError('Only JPG, PNG or WebP images are allowed.');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setUploadError('Each photo must be under 2 MB.');
        continue;
      }
      try {
        const uploaded = await uploadImage.mutateAsync(file);
        setState((s) => ({ ...s, images: [...s.images, uploaded.url] }));
      } catch {
        setUploadError('Failed to upload one of the photos. Please try again.');
      }
    }
  };

  const handleSubmit = () => {
    const nextErrors = validate(state);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      rating: state.rating,
      title: state.title.trim(),
      comment: state.comment.trim(),
      fabricRating: state.fabricRating,
      colorAccuracyRating: state.colorAccuracyRating,
      comfortRating: state.comfortRating,
      sizeFeedback: state.sizeFeedback as ReviewSizeFeedback,
      wouldRecommend: state.wouldRecommend as boolean,
      images: state.images,
    };

    if (props.mode === 'create') {
      createReview.mutate(
        { productId: props.productId, orderId: props.orderId, ...payload },
        { onSuccess: () => props.onClose() },
      );
    } else {
      updateReview.mutate(
        { id: props.review.id, data: payload },
        { onSuccess: () => props.onClose() },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{props.mode === 'edit' ? 'Edit your review' : 'Write a review'}</DialogTitle>
        <DialogDescription>
          Share details that help other shoppers — fit, fabric, and how it held up.
        </DialogDescription>

        <div className="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
          <div>
            <Label>Overall rating</Label>
            <StarRating
              value={state.rating}
              onChange={(v) => set('rating', v)}
              size="lg"
              label="Overall rating"
              className="mt-1"
            />
            {errors.rating && <p className="mt-1 text-sm text-red-600">{errors.rating}</p>}
          </div>

          <div>
            <Label htmlFor="review-title">Review title</Label>
            <input
              id="review-title"
              value={state.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={120}
              placeholder="Sum up your experience"
              aria-invalid={Boolean(errors.title)}
              className="mt-1 flex h-10 w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-[invalid=true]:border-red-500"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="review-comment">Detailed review</Label>
            <textarea
              id="review-comment"
              value={state.comment}
              onChange={(e) => set('comment', e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What did you like or dislike? How does it fit and feel?"
              aria-invalid={Boolean(errors.comment)}
              className="mt-1 w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-[invalid=true]:border-red-500"
            />
            <div className="mt-1 flex justify-between text-xs text-neutral-500">
              <span>{errors.comment && <span className="text-red-600">{errors.comment}</span>}</span>
              <span>{state.comment.length}/2000</span>
            </div>
          </div>

          <div>
            <Label>Size feedback</Label>
            <div className="mt-1 flex gap-2">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('sizeFeedback', opt.value)}
                  className={cn(
                    'flex-1 rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors',
                    state.sizeFeedback === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.sizeFeedback && (
              <p className="mt-1 text-sm text-red-600">{errors.sizeFeedback}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Fabric quality</Label>
              <StarRating
                value={state.fabricRating}
                onChange={(v) => set('fabricRating', v)}
                className="mt-1"
                label="Fabric quality"
              />
              {errors.fabricRating && (
                <p className="mt-1 text-xs text-red-600">{errors.fabricRating}</p>
              )}
            </div>
            <div>
              <Label>Color accuracy</Label>
              <StarRating
                value={state.colorAccuracyRating}
                onChange={(v) => set('colorAccuracyRating', v)}
                className="mt-1"
                label="Color accuracy"
              />
              {errors.colorAccuracyRating && (
                <p className="mt-1 text-xs text-red-600">{errors.colorAccuracyRating}</p>
              )}
            </div>
            <div>
              <Label>Comfort</Label>
              <StarRating
                value={state.comfortRating}
                onChange={(v) => set('comfortRating', v)}
                className="mt-1"
                label="Comfort"
              />
              {errors.comfortRating && (
                <p className="mt-1 text-xs text-red-600">{errors.comfortRating}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Would you recommend this product?</Label>
            <div className="mt-1 flex gap-2">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => set('wouldRecommend', opt.value)}
                  className={cn(
                    'rounded-[10px] border px-4 py-2 text-sm font-medium transition-colors',
                    state.wouldRecommend === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.wouldRecommend && (
              <p className="mt-1 text-sm text-red-600">{errors.wouldRecommend}</p>
            )}
          </div>

          <div>
            <Label>Photos (optional)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {state.images.map((url) => (
                <div key={url} className="relative h-16 w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Uploaded preview"
                    className="h-full w-full rounded-lg border border-neutral-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => set('images', state.images.filter((u) => u !== url))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-neutral-900 p-0.5 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {state.images.length < MAX_IMAGES && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:bg-neutral-50">
                  {uploadImage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    '+ Add'
                  )}
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    className="hidden"
                    multiple
                    disabled={uploadImage.isPending}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
            {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="outline" onClick={props.onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {props.mode === 'edit' ? 'Save changes' : 'Submit review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
