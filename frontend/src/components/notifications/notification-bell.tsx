'use client';

import { useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const { data } = useNotifications(signedIn);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (!signedIn) return null;

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
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
                  Nothing yet.
                </p>
              ) : (
                items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onRead={() => markRead.mutate(n.id)}
                  />
                ))
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
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const unread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={() => unread && onRead()}
      className={cn(
        'flex w-full items-start gap-2.5 border-b border-neutral-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-50',
        unread && 'bg-[#CC0000]/[0.03]',
      )}
    >
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
        </span>
      </span>
    </button>
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
