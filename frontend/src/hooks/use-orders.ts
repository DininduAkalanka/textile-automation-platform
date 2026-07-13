'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { paymentsService } from '@/services/payments.service';
import {
  AdminOrdersFilters,
  OrderMachineAction,
  ordersService,
} from '@/services/orders.service';

export const orderKeys = {
  mine: ['orders', 'mine'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  // A stable ROOT key, separate from the filtered list key below, so a mutation
  // can invalidate "every admin order list, whatever it's filtered to" without
  // knowing what any particular admin currently has typed into the search box.
  adminListRoot: ['orders', 'admin', 'list'] as const,
  adminList: (filters: AdminOrdersFilters) =>
    [...orderKeys.adminListRoot, filters] as const,
};

/** A status change touches: this order's own detail, the customer's own list,
 *  and every admin list (whatever it's filtered to) — production.service.ts's
 *  syncOrderStatus can ALSO move this order from outside any request this app
 *  made, so polling (below) covers the gap an invalidation cannot. */
function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return (orderId: string) => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
    void queryClient.invalidateQueries({ queryKey: orderKeys.adminListRoot });
  };
}

export function useMyOrders(page = 1, limit = 10) {
  return useQuery({
    queryKey: [...orderKeys.mine, page, limit],
    queryFn: () => ordersService.listMine(page, limit),
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => ordersService.getById(id!),
    enabled: Boolean(id),
    // An order confirmed by a webhook, or advanced by the production floor,
    // changes status without this browser tab doing anything — poll so the
    // tracking stepper and the admin action buttons do not go stale mid-view.
    refetchInterval: 20_000,
  });
}

export function useAdminOrders(filters: AdminOrdersFilters) {
  return useQuery({
    queryKey: orderKeys.adminList(filters),
    queryFn: () => ordersService.listAll(filters),
    placeholderData: (previous) => previous, // no flicker when paging/filtering
  });
}

/** The customer's own "Cancel order" button — PENDING only, own order only;
 *  both enforced server-side (see orders.service.ts's cancel()). */
export function useCancelMyOrder() {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      ordersService.cancelMine(id, note),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} cancelled`);
      invalidate(order.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** The three admin verbs that go through the shared order machine. */
export function useOrderAction() {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: ({
      id,
      action,
      note,
      acknowledgeRefund,
    }: {
      id: string;
      action: OrderMachineAction;
      note?: string;
      acknowledgeRefund?: boolean;
    }) => ordersService.action(id, action, { note, acknowledgeRefund }),
    onSuccess: (order, { action }) => {
      const label =
        action === 'cancel'
          ? 'cancelled'
          : action === 'advance'
            ? 'marked fulfilled'
            : 'marked delivered';
      toast.success(`Order ${order.orderNumber} ${label}`);
      invalidate(order.id);
    },
    // Cancel's refund gate returns a specific 400 ("paid in full... acknowledge
    // the refund") — surfacing it verbatim is the whole point of that message.
    onError: (error: Error) => toast.error(error.message),
  });
}

/** "Confirm order" and "Mark cash collected" — the same payment action under
 *  two labels; see AdminOrderAction's docblock in types/index.ts. */
export function useMarkPaid() {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note?: string }) =>
      paymentsService.markPaid(orderId, note),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} confirmed`);
      invalidate(order.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
