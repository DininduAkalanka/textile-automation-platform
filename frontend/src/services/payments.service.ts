import { Order } from '@/types';

import { http, unwrap } from './http';

/**
 * Minimal, modern-pattern wrapper around the ALREADY-BUILT payment admin
 * routes — `lib/api.ts` has its own copy (used by the existing /admin/payments
 * page, untouched by this phase). This one exists for the NEW admin order
 * detail page's "Confirm" and "Mark cash collected" buttons, which are the
 * SAME backend action (POST /payments/admin/:orderId/mark-paid) under two
 * different labels depending on where the order is in its lifecycle — see
 * order.machine.ts's header comment on why that action was never re-derived
 * inside the order machine itself.
 */
export const paymentsService = {
  markPaid: (orderId: string, note?: string) =>
    unwrap<Order>(http.post(`/payments/admin/${orderId}/mark-paid`, { note })),
};
