'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';

export const analyticsKeys = {
  reorder: ['analytics', 'reorder'] as const,
  forecast: ['analytics', 'forecast'] as const,
  trending: ['analytics', 'trending'] as const,
  topProducts: (period: string) => ['analytics', 'top-products', period] as const,
  deadStock: ['analytics', 'dead-stock'] as const,
  recommendations: ['analytics', 'recommendations'] as const,
};

// A forecast fit takes a moment and rarely changes within a session — cache it
// generously so flipping between admin pages doesn't refit every time.
const STALE = 5 * 60 * 1000;

export function useReorder() {
  return useQuery({
    queryKey: analyticsKeys.reorder,
    queryFn: analyticsService.reorder,
    staleTime: STALE,
  });
}

export function useForecast() {
  return useQuery({
    queryKey: analyticsKeys.forecast,
    queryFn: analyticsService.forecast,
    staleTime: STALE,
  });
}

export function useTrending() {
  return useQuery({
    queryKey: analyticsKeys.trending,
    queryFn: analyticsService.trending,
    staleTime: STALE,
  });
}

export function useTopProducts(period = '90d') {
  return useQuery({
    queryKey: analyticsKeys.topProducts(period),
    queryFn: () => analyticsService.topProducts(period),
    staleTime: STALE,
  });
}

export function useDeadStock() {
  return useQuery({
    queryKey: analyticsKeys.deadStock,
    queryFn: analyticsService.deadStock,
    staleTime: STALE,
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: analyticsKeys.recommendations,
    queryFn: analyticsService.recommendations,
    staleTime: STALE,
  });
}
