'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Accessible label prefix, e.g. "Overall rating" -> "Overall rating: 3 of 5 stars". */
  label?: string;
}

/**
 * Dual-purpose: read-only display when `onChange` is omitted, interactive
 * 1-5 picker (keyboard + click, hover preview) when it's provided. One
 * component for both keeps the exact star glyph/spacing identical between a
 * submitted review and the form that created it.
 */
export function StarRating({ value, onChange, size = 'md', className, label }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = Boolean(onChange);
  const display = hovered ?? value;

  if (!interactive) {
    return (
      <div
        className={cn('inline-flex items-center gap-0.5', className)}
        role="img"
        aria-label={`${label ? `${label}: ` : ''}${value} of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              SIZE_CLASSES[size],
              n <= value ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200',
            )}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      onMouseLeave={() => setHovered(null)}
      role="radiogroup"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5 stars`}
          onMouseEnter={() => setHovered(n)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(null)}
          onClick={() => onChange?.(n)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Star
            className={cn(
              SIZE_CLASSES[size],
              'transition-colors',
              n <= display ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200',
            )}
          />
        </button>
      ))}
    </div>
  );
}
