'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsService } from '@/services/notifications.service';

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
};

/**
 * The bell, for both navbars (plan 7.1 task 4).
 *
 * Polled rather than pushed — there is no websocket layer in this system, and a
 * notification here is never so time-critical that 30 seconds of staleness
 * matters (contrast with production's pipeline board, which several people
 * watch simultaneously). `enabled` gates it on being signed in at all, so a
 * logged-out visitor never fires an authenticated poll that will 401 forever.
 */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => notificationsService.list(1, 20),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: notificationKeys.list });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: invalidate,
    // No error toast: a notification failing to mark itself read is not
    // something worth interrupting the user over — it just tries again later.
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: invalidate,
  });
}
