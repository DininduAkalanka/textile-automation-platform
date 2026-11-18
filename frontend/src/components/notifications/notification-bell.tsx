'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { Bell, CheckCheck } from 'lucide-react';

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { Notification } from '@/types';

/**
 * The bell (plan Session 7.1, task 4) — one component, both navbars.
 *
 * Hand-rolled dropdown, not a Radix Popover: the project has no popover/menu
 * primitive installed, and the customer Header already solves "positioned
 * panel + click-outside to close" for its own account menu with a plain
 * `fixed inset-0` overlay. This mirrors that exact technique rather than
 * pulling in a new dependency for one component.
 *
 * Plain Tailwind utility classes only — no CSS custom properties — so it
 * renders identically whether it lands in the admin topbar (Tailwind-only
 * already) or the customer Header (which layers Tailwind over its own
 * `var(--clr-*)` system for everything else). A shared component that only
 * half-fits either surface would be worse than two smaller ones.
 */
export function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const feed = useNotifications(user?.id, mounted && signedIn && Boolean(user));
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (!mounted || !signedIn) return null;

  const unreadCount = feed.data?.pages[0].unreadCount ?? 0;
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#CC0000] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            aria-hidden
          />
          <div className="fixed inset-x-4 top-[66px] z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  <CheckCheck size={12} aria-hidden />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-400">
                  {feed.isPending ? 'Loading notifications…' : feed.isError ? 'Could not load notifications.' : 'Nothing yet.'}
                </p>
              ) : (
                items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    admin={user?.role === 'ADMIN'}
                    onActivate={(navigating) => {
                      if (!n.readAt) markRead.mutate(n.id);
                      if (navigating) setOpen(false);
                    }}
                  />
                ))
              )}
              {feed.hasNextPage && (
                <button type="button" disabled={feed.isFetchingNextPage}
                  onClick={() => void feed.fetchNextPage()}
                  className="w-full px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  {feed.isFetchingNextPage ? 'Loading…' : 'Show older notifications'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  admin,
  onActivate,
}: {
  notification: Notification;
  admin: boolean;
  onActivate: (navigating: boolean) => void;
}) {
  const unread = notification.readAt === null;
  const { type, targetId, title } = notification;
  let href: string | undefined;
  let action: string | undefined;
  if (type === 'order.status_changed') {
    const orders = admin ? '/admin/orders' : '/account/orders';
    href = targetId ? `${orders}/${encodeURIComponent(targetId)}` : orders;
    action = targetId ? 'View order' : 'View orders';
  } else if (admin && type === 'inventory.low_stock') {
    href = targetId
      ? `/admin/inventory?productId=${encodeURIComponent(targetId)}`
      : `/admin/inventory?search=${encodeURIComponent(title.replace(/^Low stock: /, ''))}`;
    action = targetId ? 'View stock' : 'Find in inventory';
  }

  const className = cn(
    'flex w-full items-start gap-2.5 border-b border-neutral-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-50',
    unread && 'bg-[#CC0000]/[0.03]',
  );
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
          unread ? 'bg-[#CC0000]' : 'bg-transparent',
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[13px] leading-snug',
            unread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-600',
          )}
        >
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
            {notification.body}
          </span>
        )}
        <span className="mt-1 block text-[11px] text-neutral-400">
          {relativeTime(notification.createdAt)}
          {action && <span className="ml-2 font-medium text-[#A80000]">{action} →</span>}
        </span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} prefetch={false} className={className} onClick={() => onActivate(true)}>{content}</Link>
  ) : (
    <button type="button" disabled={!unread} className={className} onClick={() => onActivate(false)}>{content}</button>
  );
}

/** "3h ago", not a full timestamp — a notification list is read at a glance,
 *  not audited; the exact second is one tap away on the order itself. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
