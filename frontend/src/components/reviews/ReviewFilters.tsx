'use client';

import { Check } from 'lucide-react';

import { ReviewSortBy } from '@/types';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: { value: ReviewSortBy; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rating' },
  { value: 'lowest', label: 'Lowest Rating' },
  { value: 'helpful', label: 'Most Helpful' },
];

export interface ReviewFilterState {
  sortBy: ReviewSortBy;
  rating?: number;
  hasPhotos: boolean;
  verifiedOnly: boolean;
}

const DEFAULT_STATE: ReviewFilterState = {
  sortBy: 'recent',
  rating: undefined,
  hasPhotos: false,
  verifiedOnly: false,
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50',
      )}
    >
      {active && <Check className="h-3 w-3" aria-hidden />}
      {children}
    </button>
  );
}

export function ReviewFilters({
  value,
  onChange,
}: {
  value: ReviewFilterState;
  onChange: (next: ReviewFilterState) => void;
}) {
  const isFiltered = Boolean(value.rating || value.hasPhotos || value.verifiedOnly);

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => (
            <Chip
              key={star}
              active={value.rating === star}
              onClick={() => onChange({ ...value, rating: value.rating === star ? undefined : star })}
            >
              {star}★
            </Chip>
          ))}
        </div>

        <span className="hidden h-4 w-px bg-neutral-200 sm:block" aria-hidden />

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={value.hasPhotos} onClick={() => onChange({ ...value, hasPhotos: !value.hasPhotos })}>
            With Photos
          </Chip>
          <Chip
            active={value.verifiedOnly}
            onClick={() => onChange({ ...value, verifiedOnly: !value.verifiedOnly })}
          >
            Verified Purchases
          </Chip>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_STATE, sortBy: value.sortBy })}
            className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-600">
        Sort by
        <select
          value={value.sortBy}
          onChange={(e) => onChange({ ...value, sortBy: e.target.value as ReviewSortBy })}
          className="rounded-[10px] border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
