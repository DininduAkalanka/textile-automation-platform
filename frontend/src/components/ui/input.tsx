'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-[10px] border border-neutral-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-neutral-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // aria-invalid is set by FormField when the field has an error, so the
        // red border is driven by the same state a screen reader announces.
        'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
