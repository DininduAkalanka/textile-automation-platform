'use client';

import { useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

/** Same rule as the API: letters in any script, with spaces, ' - . between them. */
const PERSON_NAME = /^[\p{L}\p{M}]+(?:[ .'’-]+[\p{L}\p{M}]+)*\.?$/u;
const tidy = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * Lets the signed-in person correct their own name. It greets them after
 * sign-in and appears on invoices, order emails and the admin header, and
 * before this a name mistyped at registration or guest checkout could never
 * be changed.
 */
export function ProfileNameForm() {
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const validate = (first: string, last: string): string => {
    if (!first) return 'Enter your first name.';
    if (!last) return 'Enter your last name.';
    if (first.length > 50 || last.length > 50) return 'Names can be up to 50 characters.';
    if (!PERSON_NAME.test(first) || !PERSON_NAME.test(last)) {
      return 'Names may contain letters, spaces, apostrophes, hyphens and full stops only.';
    }
    return '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = tidy(firstName);
    const last = tidy(lastName);
    const problem = validate(first, last);
    setError(problem);
    setSaved(false);
    if (problem) return;

    setSaving(true);
    try {
      const updated = await api.updateProfile(first, last);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName });
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-[#CC0000] focus:outline-none focus:ring-1 focus:ring-[#CC0000]';

  return (
    <section aria-labelledby="your-name-heading" className="mt-8">
      <h2 id="your-name-heading" className="mb-1 text-lg font-semibold text-neutral-900">
        Your name
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        Shown when you sign in and on your invoices and order emails.
      </p>

      {saved && (
        <div role="status" data-testid="profile-name-success" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Your name has been updated.
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-first-name" className="mb-1 block text-xs font-semibold text-neutral-800">First name</label>
            <input id="profile-first-name" data-testid="profile-first-name" autoComplete="given-name" maxLength={50} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="profile-last-name" className="mb-1 block text-xs font-semibold text-neutral-800">Last name</label>
            <input id="profile-last-name" data-testid="profile-last-name" autoComplete="family-name" maxLength={50} value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
          </div>
        </div>

        {error && (
          <p role="alert" data-testid="profile-name-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} data-testid="profile-name-submit" className="btn btn-outline w-full disabled:opacity-70">
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </section>
  );
}
