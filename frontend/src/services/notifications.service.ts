import { NotificationsResponse } from '@/types';

import { http, unwrap } from './http';

export const notificationsService = {
  list: (page = 1, limit = 20) =>
    unwrap<NotificationsResponse>(http.get('/notifications', { params: { page, limit } })),

  markRead: (id: string) =>
    unwrap<{ success: boolean }>(http.put(`/notifications/${id}/read`, {})),

  markAllRead: () =>
    unwrap<{ success: boolean }>(http.put('/notifications/read-all', {})),
};
