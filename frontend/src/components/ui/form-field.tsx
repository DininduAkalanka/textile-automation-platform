'use client';

import * as React from 'react';
import { Input, InputProps } from './input';
import { Label } from './label';
import { PASSWORD_SAFE_ATTRS, PasswordRevealButton, usePasswordReveal } from './password-reveal';
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
  ({ label, error, id, className, type, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const errorId = `${fieldId}-error`;
    // Password fields get a show/hide button (people could not check what they
    // typed on sign-in, register or reset) plus the attributes that keep a
    // revealed password away from spellcheck and autocorrect.
    const isPassword = type === 'password';
    const reveal = usePasswordReveal();

    const input = (
      <Input
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
        {...(isPassword ? PASSWORD_SAFE_ATTRS : {})}
        type={isPassword ? reveal.type : type}
        className={cn(isPassword && 'pr-11', className)}
      />
    );

    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        {isPassword ? (
          <div className="relative">
            {input}
            <PasswordRevealButton shown={reveal.shown} onToggle={reveal.toggle} controls={fieldId} />
          </div>
        ) : (
          input
        )}
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
