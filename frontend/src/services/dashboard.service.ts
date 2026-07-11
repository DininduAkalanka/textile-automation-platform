import { DashboardResponse } from '@/types';
import { http, unwrap } from './http';

export const dashboardService = {
  /**
   * Server-aggregated metrics. Revenue counts COMPLETED payments only and is
   * computed in SQL — never summed client-side over a page of orders.
   */
  get: (from?: string, to?: string) =>
    unwrap<DashboardResponse>(
      http.get('/admin/dashboard', { params: { from, to } }),
    ),
};
