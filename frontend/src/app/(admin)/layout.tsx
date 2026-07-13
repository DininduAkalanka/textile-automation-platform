'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const loadUser = useAuthStore((s) => s.loadUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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
          <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
            <div className="relative h-full">
              <AdminSidebar />
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
            <span className="hidden text-xs text-neutral-400 sm:inline">
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <NotificationBell signedIn={isAuthenticated} />
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
