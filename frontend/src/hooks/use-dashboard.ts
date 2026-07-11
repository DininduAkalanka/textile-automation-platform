'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  range: (from?: string, to?: string) =>
    [...dashboardKeys.all, { from, to }] as const,
};

/**
 * Admin dashboard metrics. Components read this hook; they never call the API
 * directly (CODING_STANDARDS §6.1).
 */
export function useDashboard(from?: string, to?: string) {
  return useQuery({
    queryKey: dashboardKeys.range(from, to),
    queryFn: () => dashboardService.get(from, to),
  });
}
