'use client';

import * as React from 'react';
import { Input, InputProps } from './input';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends InputProps {
  label: string;
  /** The react-hook-form error message for this field, if any. */
  error?: string;
}

/**
 * A labelled input that reports its own errors accessibly (doc 10 §11, WCAG 2.1).
 *
 * The three attributes that matter, and which hand-rolled forms usually miss:
 *   - htmlFor/id, so clicking the label focuses the input;
 *   - aria-invalid, so a screen reader announces the field as errored (and the
 *     Input's red border keys off the same state, rather than a separate class);
 *   - aria-describedby -> the error's id, so the reason is read out, not just
 *     shown in red to sighted users.
 */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const errorId = `${fieldId}-error`;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        <Input
          id={fieldId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(className)}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';
