import { Order, OrderStatus, OrdersResponse } from '@/types';

import { http, unwrap } from './http';

export interface AdminOrdersFilters {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  method?: 'STRIPE' | 'PAYHERE' | 'COD' | 'INSTALLMENT';
  from?: string;
  to?: string;
  search?: string;
}

/** The three verbs that go through the shared order machine — see
 *  order.machine.ts. "confirm" and "mark_collected" are payment actions and
 *  live on paymentsService instead; see AdminOrderAction's own comment. */
export type OrderMachineAction = 'cancel' | 'advance' | 'deliver';

/**
 * Order creation stays on the legacy `lib/api.ts` client — checkout
 * (`(shop)/checkout/page.tsx`) already calls `api.createOrder()` and works.
 * This service is for the surfaces Phase 7 actually builds: reading orders
 * (customer + admin) and the admin action verbs.
 */
export const ordersService = {
  listMine: (page = 1, limit = 10) =>
    unwrap<OrdersResponse>(http.get('/orders', { params: { page, limit } })),

  getById: (id: string) => unwrap<Order>(http.get(`/orders/${id}`)),

  /** Plan 7.1 task 3: "Cancel button only in PENDING" — the SERVER enforces
   *  that (and ownership); this just calls the customer-facing route. */
  cancelMine: (id: string, note?: string) =>
    unwrap<Order>(http.put(`/orders/${id}/cancel`, { note })),

  // ─── Admin ──────────────────────────────────────────────────────────────

  listAll: (filters: AdminOrdersFilters = {}) =>
    unwrap<OrdersResponse>(http.get('/orders/admin/all', { params: filters })),

  action: (
    id: string,
    action: OrderMachineAction,
    opts: { note?: string; acknowledgeRefund?: boolean } = {},
  ) => unwrap<Order>(http.put(`/orders/admin/${id}/action`, { action, ...opts })),
};
