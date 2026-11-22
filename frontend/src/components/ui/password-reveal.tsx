'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Attributes every password field needs once it can be shown as plain text.
 *
 * While a password is visible the field is an ordinary text box, and browsers
 * treat it like one: enhanced spellcheck can send the contents of text fields
 * to a remote service, and autocorrect / autocapitalise can silently change
 * what was typed. None of that may happen to a password, so these are always
 * off on a password field, shown or not.
 */
export const PASSWORD_SAFE_ATTRS = {
  spellCheck: false,
  autoCorrect: 'off',
  autoCapitalize: 'none',
} as const;

/** Show/hide state for one password field. Hidden until the person asks. */
export function usePasswordReveal() {
  const [shown, setShown] = React.useState(false);
  return {
    shown,
    type: shown ? 'text' : 'password',
    toggle: () => setShown((s) => !s),
  } as const;
}

/**
 * The eye button that sits inside the right edge of a password field. It is a
 * real button (keyboard reachable, never submits the form) and tells screen
 * readers what it will do and which field it controls.
 */
export function PasswordRevealButton({
  shown,
  onToggle,
  controls,
  className,
}: {
  shown: boolean;
  onToggle: () => void;
  controls?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      aria-controls={controls}
      title={shown ? 'Hide password' : 'Show password'}
      className={cn(
        'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[10px]',
        // Mid grey and brand red both stay visible (3:1+) on the white fields
        // and on the dark sign-in / register / reset fields.
        'text-neutral-500 transition-colors hover:text-[#CC0000]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC0000]',
        className,
      )}
    >
      {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  );
}
