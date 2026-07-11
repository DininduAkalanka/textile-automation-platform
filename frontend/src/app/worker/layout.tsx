'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';

/**
 * Worker shell (plan Session 1.2, task 4).
 *
 * Deliberately minimal: doc 10 §2 calls workers "task-focused minimal UI", and
 * §10 asks for large touch targets. This is a factory floor — the person using
 * it is standing at a cutting table on a phone, so the shell gives them a title,
 * a sign-out, and nothing else to get lost in.
 */
export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/worker/tasks" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-600 text-sm font-bold text-white">
              T
            </div>
            <span className="text-lg font-semibold text-neutral-900">
              My Tasks
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-neutral-500 sm:inline">
                {user.firstName}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
