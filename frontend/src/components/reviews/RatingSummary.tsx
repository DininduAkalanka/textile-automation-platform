'use client';

import { Star } from 'lucide-react';

import { ReviewStats } from '@/types';

import { StarRating } from './StarRating';

/**
 * Vertical, sidebar-oriented summary (Amazon/Nike pattern): a large average
 * figure with its star row up top, a full-width 5★→1★ distribution below.
 * Purely presentational — same `stats` shape ReviewsSection already fetches.
 */
export function RatingSummary({ stats }: { stats: ReviewStats }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="text-5xl font-bold leading-none tracking-tight text-neutral-900">
          {stats.total > 0 ? stats.average.toFixed(1) : '0.0'}
        </span>
        <div className="flex flex-col gap-1.5">
          <StarRating value={Math.round(stats.average)} size="md" label="Average rating" />
          <span className="text-sm text-neutral-500">
            {stats.total > 0
              ? `Based on ${stats.total} review${stats.total === 1 ? '' : 's'}`
              : 'No reviews yet'}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = stats.distribution[star];
          const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2.5 text-xs">
              <span className="flex w-7 shrink-0 items-center gap-1 font-medium text-neutral-600">
                {star}
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-neutral-500">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
