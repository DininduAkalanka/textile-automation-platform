'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { registerSchema } from '@/lib/schemas';
import { useAuthStore } from '@/store/useAuthStore';

/** Admins and managers can see every order and customer: longer passwords (the API enforces the same). */
const STAFF_ROLES = new Set(['ADMIN', 'MANAGER']);
const STAFF_MIN_LENGTH = 12;

/**
 * Change password — for every signed-in account (customer, admin, worker).
 *
 * Before this page there was no way to change a password at all, so a shop
 * owner could not replace the one they were handed. On success the server
 * signs out every other device and returns a fresh session for this one.
 */
export default function AccountSecurityPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!mounted) {
    return <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}><div className="skeleton" style={{ height: '320px', maxWidth: '28rem' }} /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Please sign in</h1>
        <Link href="/login?returnTo=/account/security" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  const isStaff = STAFF_ROLES.has(String(user?.role ?? ''));
  const minLength = isStaff ? STAFF_MIN_LENGTH : 8;

  const validate = (): string => {
    if (!current) return 'Enter your current password.';
    // Same rules as registration and password reset (8–64 characters, upper
    // and lower case letters and a number), plus 12+ for admins and managers.
    const rule = registerSchema.shape.password.safeParse(next);
    if (!rule.success) return rule.error.issues[0].message;
    if (next.length < minLength) return `Admin and manager passwords must be at least ${STAFF_MIN_LENGTH} characters.`;
    if (next === current) return 'Choose a new password that is different from your current one.';
    if (next !== confirm) return 'The two new passwords do not match.';
    return '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      const session = await api.changePassword(current, next);
      // The server revoked every old session and issued a new one for this browser.
      setAuth(session.user, session.accessToken);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-[#CC0000] focus:outline-none focus:ring-1 focus:ring-[#CC0000]';

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '32rem' }}>
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/account/orders" className="hover:text-neutral-900">My Account</Link>
        <span aria-hidden className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900" aria-current="page">Change Password</span>
      </nav>

      <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Change Password
      </h1>
      <p className="mb-6 text-sm text-neutral-600">
        Signed in as <strong className="text-neutral-900">{user?.email ?? 'your account'}</strong>. Changing your
        password signs you out on every other device.
      </p>

      {done && (
        <div role="status" data-testid="change-password-success" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Your password has been changed. Any other devices have been signed out.
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <div>
          <label htmlFor="current-password" className="mb-1 block text-xs font-semibold text-neutral-800">Current password</label>
          <input id="current-password" data-testid="current-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-xs font-semibold text-neutral-800">New password</label>
          <input id="new-password" data-testid="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={minLength} maxLength={64} value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="new-password-hint" className={field} />
          <p id="new-password-hint" className="mt-1 text-[11px] text-neutral-500">At least {minLength} characters, with an uppercase letter, a lowercase letter and a number. A short phrase is easy to remember and hard to guess.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-xs font-semibold text-neutral-800">Confirm new password</label>
          <input id="confirm-password" data-testid="confirm-password" type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={64} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show passwords
        </label>

        {error && (
          <p role="alert" data-testid="change-password-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} data-testid="change-password-submit" className="btn btn-primary w-full disabled:opacity-70">
          {submitting ? 'Changing…' : 'Change Password'}
        </button>
        <p className="text-center text-xs text-neutral-500">
          Forgot your current password? <Link href="/forgot-password" className="text-[#CC0000] underline underline-offset-2">Reset it instead</Link>
        </p>
      </form>
    </div>
  );
}
