import { OrderStatus } from '@prisma/client';

/**
 * The order status machine (plan §4.1, BR6).
 *
 * This is the function production.machine.ts's own header comment already
 * promised existed: "so the service layer never hand-assigns a stage or status
 * (the same discipline the order machine uses via transition())." It didn't, until
 * now — order status was hand-set in two places that disagreed with each other.
 *
 * `orders.service.ts` kept a `validTransitions` map local to `updateStatus()`,
 * unexported, forbidding QUALITY_CHECK → IN_PRODUCTION. `production.service.ts`'s
 * `syncOrderStatus()` never consulted that map at all — it just wrote
 * `tx.order.update({ status })` directly, and CORRECTLY sent an order from
 * QUALITY_CHECK back to IN_PRODUCTION on a QC failure (a task rejected at
 * inspection must pull the order back out of "being inspected"). One module
 * enforced a rule the other module was silently breaking every time a garment
 * failed QC — both individually "worked", and together they were incoherent.
 *
 * One graph, imported by both. A future disagreement between them is now a
 * compile-time impossibility, not a bug waiting for someone to fail QC in
 * production and notice the order status lied.
 */

/** Every legal edge, exactly as diagrammed in plan §4.1. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [
    OrderStatus.IN_PRODUCTION,
    OrderStatus.COMPLETED, // fulfillment-only: no production items at all
    OrderStatus.CANCELLED,
  ],
  IN_PRODUCTION: [OrderStatus.QUALITY_CHECK],
  QUALITY_CHECK: [
    OrderStatus.COMPLETED,
    // THE FIX: a QC failure sends work back to the floor, which pulls the order
    // back out of "being inspected". See production.machine.ts's `qc_fail` — this
    // is not a hypothetical edge, it is one this codebase already exercises.
    OrderStatus.IN_PRODUCTION,
  ],
  COMPLETED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export class IllegalOrderTransition extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot move an order from ${from} to ${to}`);
    this.name = 'IllegalOrderTransition';
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throws IllegalOrderTransition rather than returning false — for callers
 *  (both admin actions and the production sync) where an illegal move reaching
 *  this point is not a user mistake to report politely, it is a bug to surface
 *  loudly. Swallowing it would hide exactly the class of error this file exists
 *  to catch. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalOrderTransition(from, to);
  }
}

// ─── Admin-facing verbs (plan Session 7.1, task 2) ─────────────────────────
//
// Deliberately NOT every status change. "Confirm" and "mark cash collected" are
// PAYMENT actions with an order-status side effect — they already exist, tested,
// as PaymentsService.markPaymentPaid (PENDING payment → COMPLETED, which calls
// the already-idempotent OrdersService.confirmOrder). Re-deriving that here would
// be a second, competing path to the exact state that method already reaches
// correctly. The three verbs below are the ones with no existing owner.

export type OrderAction = 'cancel' | 'advance' | 'deliver';

export const ORDER_ACTION_TARGET: Record<OrderAction, OrderStatus> = {
  cancel: OrderStatus.CANCELLED,
  advance: OrderStatus.COMPLETED, // fulfillment-only orders only — see the service
  deliver: OrderStatus.DELIVERED,
};

/**
 * Which of the three verbs are legal from `status` alone. `hasProductionTasks`
 * narrows `advance` further: reaching COMPLETED from CONFIRMED is legal in the
 * GRAPH for any order, but `advance` specifically means "this order has no
 * production tasks to wait for" (fulfillment-only) — an order WITH tasks reaches
 * COMPLETED automatically, driven by the floor, and offering the admin a button
 * that races that automation would let a garment ship before it was made.
 *
 * Mirrors production.machine.ts's own allowedActions(): the pure graph decides
 * what is POSSIBLE, and one extra, row-specific rule narrows what is OFFERED.
 */
export function allowedOrderActions(order: {
  status: OrderStatus;
  hasProductionTasks: boolean;
}): OrderAction[] {
  return (Object.keys(ORDER_ACTION_TARGET) as OrderAction[]).filter(
    (action) => {
      if (!canTransition(order.status, ORDER_ACTION_TARGET[action])) {
        return false;
      }
      if (action === 'advance' && order.hasProductionTasks) return false;
      return true;
    },
  );
}

// ─── Customer notifications (plan Session 7.1, task 4) ─────────────────────
//
// "confirmation, status changes, and payment events already insert rows — audit
// gaps and fill any missing producers." They did not: inventory's low-stock
// alert (Phase 5) was the only thing in the whole system that ever wrote a
// Notification row. Every order status change reaches the customer through this
// ONE function, whether it was caused by an admin action (orders.service.ts) or
// by the production floor (production.service.ts's syncOrderStatus) — a customer
// should hear about their order moving for the SAME reason regardless of which
// service happened to move it.
//
// Pure and side-effect-free on purpose: the actual `tx.notification.create` write
// is four identical lines repeated at each call site, and duplicating four lines
// of I/O is a fair trade for keeping the WORDING in exactly one place, testable
// without a database.

export interface StatusNotification {
  title: string;
  body: string;
}

/**
 * The copy for a customer-facing status notification, or null when a status has
 * nothing worth telling the customer (PENDING is the order they just placed
 * themselves — notifying them of their own action is noise, not information).
 *
 * `detail`, when given, is appended to the body — used for CANCELLED to carry
 * the refund situation, which the machine cannot know on its own (it depends on
 * the payment row, which lives outside this file's pure state graph).
 */
export function orderStatusNotification(
  status: OrderStatus,
  orderNumber: string,
  detail?: string,
): StatusNotification | null {
  const withDetail = (body: string) => (detail ? `${body} ${detail}` : body);

  switch (status) {
    case OrderStatus.PENDING:
      return null;
    case OrderStatus.CONFIRMED:
      return {
        title: `Order ${orderNumber} confirmed`,
        body: withDetail('Payment received — we are getting your order ready.'),
      };
    case OrderStatus.IN_PRODUCTION:
      return {
        title: `Order ${orderNumber} is in production`,
        body: withDetail('Your garment has gone to the cutting table.'),
      };
    case OrderStatus.QUALITY_CHECK:
      return {
        title: `Order ${orderNumber} is being inspected`,
        body: withDetail('A final quality check before it ships.'),
      };
    case OrderStatus.COMPLETED:
      return {
        title: `Order ${orderNumber} is ready`,
        body: withDetail('Your order is complete and ready for delivery.'),
      };
    case OrderStatus.DELIVERED:
      return {
        title: `Order ${orderNumber} delivered`,
        body: withDetail('Thank you for shopping with us.'),
      };
    case OrderStatus.CANCELLED:
      return {
        title: `Order ${orderNumber} cancelled`,
        body: withDetail('This order has been cancelled.'),
      };
  }
}
