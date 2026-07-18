import {
  DeadStockResponse,
  ForecastResponse,
  RecommendationsResponse,
  ReorderResponse,
  TopProductsResponse,
  TrendingResponse,
} from '@/types';
import { http, unwrap } from './http';

/**
 * Predictive analytics for /admin/analytics. The heavy lifting (Holt-Winters
 * forecast, reorder-vs-stock) runs in the Python AI service; the API proxies it.
 * Each call can come back { unavailable: true } if that service is cold — the UI
 * handles that honestly rather than pretending.
 */
export const analyticsService = {
  reorder: () => unwrap<ReorderResponse>(http.get('/admin/analytics/reorder')),
  forecast: () =>
    unwrap<ForecastResponse>(http.get('/admin/analytics/forecast')),
  trending: () =>
    unwrap<TrendingResponse>(http.get('/admin/analytics/trending')),
  topProducts: (period = '90d') =>
    unwrap<TopProductsResponse>(
      http.get('/admin/analytics/top-products', { params: { period } }),
    ),
  deadStock: () =>
    unwrap<DeadStockResponse>(http.get('/admin/analytics/dead-stock')),
  recommendations: () =>
    unwrap<RecommendationsResponse>(
      http.get('/admin/analytics/recommendations'),
    ),
};
