'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * The admin shell (plan Session 1.2, task 4).
 *
 * Its OWN route group — deliberately outside (shop). The admin pages used to live
 * inside the shop layout, which meant an admin saw the customer navigation
 * ("WOMEN", "NEW ARRIVALS"), the customer footer, and the customer SHOPPING
 * ASSISTANT floating over the revenue figures. That is not a styling problem; it
 * is the wrong application wrapped around the right one.
 *
 * The customer chat widget is deliberately absent here. The owner has their own
 * assistant at /admin/ai-insights, which answers a different question entirely.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const loadUser = useAuthStore((s) => s.loadUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  // null on both the server render and the client's first render (they must
  // match); filled in a tick later, client-only, to avoid a hydration
  // mismatch if the two renders land on opposite sides of midnight.
  const [today, setToday] = useState<string | null>(null);

  const effectiveAuthed =
    isAuthenticated ||
    (typeof window !== 'undefined' && Boolean(window.localStorage.getItem('token')));
  const effectiveRole =
    user?.role ||
    (typeof window !== 'undefined'
      ? (() => {
          try {
            return JSON.parse(window.localStorage.getItem('user') || '{}')?.role;
          } catch {
            return null;
          }
        })()
      : null);

  useEffect(() => {
    loadUser().finally(() => {
      setHasCheckedAuth(true);
    });
  }, [loadUser]);

  useEffect(() => {
    if (hasCheckedAuth && (!effectiveAuthed || effectiveRole !== 'ADMIN')) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hasCheckedAuth, effectiveAuthed, effectiveRole, router, pathname]);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    );
  }, []);

  if (hasCheckedAuth && (!effectiveAuthed || effectiveRole !== 'ADMIN')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-600 mb-2">
            Admin authentication required. Redirecting to sign in…
          </p>
          <Link
            href={`/login?returnTo=${encodeURIComponent(pathname)}`}
            className="text-xs font-semibold text-[#CC0000] hover:underline"
          >
            Click here if not redirected automatically
          </Link>
        </div>
      </div>
    );
  }

  return (
    // Warm canvas (#FAFAF8), not a cool grey. A cool background under a warm
    // crimson brand is a discord you feel before you can name it — and it is why
    // the first version read as generic.
    <div className="min-h-screen bg-[#FAFAF8]">
      <AdminSidebar />

      {/* Mobile: the sidebar is hidden; a slide-over stands in for it. */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <div className="relative h-full">
              <AdminSidebar mobile />
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-4 z-10 rounded p-1 text-white/60 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      <div className="lg:pl-60">
        {/* Slim top bar. Deliberately quiet — the sidebar is the navigation, and a
            second heavy header would just steal room from the data. */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#EAE8E1] bg-[#FAFAF8]/85 px-4 backdrop-blur-md lg:px-8">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-[#4A4740] hover:bg-[#F4F3EF] lg:hidden"
          >
            <Menu size={18} />
          </button>

          <Link href="/admin" className="lg:hidden">
            <span className="font-display text-sm font-semibold">Nandana Admin</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {today && (
              <span className="hidden text-xs text-neutral-400 sm:inline">{today}</span>
            )}
            <NotificationBell signedIn={isAuthenticated} />
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
