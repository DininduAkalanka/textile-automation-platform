'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  InventoryFilters,
  inventoryService,
} from '@/services/inventory.service';
import { AdjustmentType } from '@/types/inventory';

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (filters: InventoryFilters) => ['inventory', 'list', filters] as const,
  lowStock: ['inventory', 'low-stock'] as const,
  movements: (productId: string) =>
    ['inventory', 'movements', productId] as const,
};

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => inventoryService.list(filters),
    // Stock moves under you while you look at it — a customer can check out at
    // any moment. A stale "12 available" that is really 4 is how an admin writes
    // off cloth that has already been sold.
    refetchInterval: 30_000,
    placeholderData: (previous) => previous, // no flicker when paging or filtering
  });
}

/**
 * The low-stock count. Polled, because it drives the sidebar badge on EVERY admin
 * page — an owner sitting on the dashboard should see the badge appear when a
 * sale takes something under its minimum, without navigating anywhere.
 */
export function useLowStock() {
  return useQuery({
    queryKey: inventoryKeys.lowStock,
    queryFn: inventoryService.lowStock,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMovements(productId: string | null) {
  return useQuery({
    queryKey: inventoryKeys.movements(productId ?? ''),
    queryFn: () => inventoryService.movements(productId!),
    // Only fetch the ledger for the row the admin actually opened. Prefetching a
    // full audit trail for every row on the page would be a lot of query for a
    // drawer most people never open.
    enabled: Boolean(productId),
  });
}

/**
 * Any stock write can change the list, the badge AND that product's ledger, so
 * every mutation invalidates all three. `inventoryKeys.all` is a prefix of the
 * other two, so one invalidation covers the lot — and correctness beats saving a
 * request on a screen one person uses.
 */
function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  };
}

export function useAdjustStock() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({
      productId,
      change,
      type,
      note,
    }: {
      productId: string;
      change: number;
      type: AdjustmentType;
      note?: string;
    }) => inventoryService.adjust(productId, change, type, note),

    onSuccess: (item, { change }) => {
      toast.success(
        `${item.name}: ${change > 0 ? '+' : ''}${change} — ${item.available} in stock`,
      );
      invalidate();
    },

    // The API refuses to take stock below zero, or below what is already reserved
    // (BR4), and its message names WHICH floor was hit and by how much. Showing it
    // verbatim is the difference between "invalid adjustment" and "that would leave
    // 5 available, but 8 are reserved for orders already placed".
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetMinimum() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: ({
      productId,
      minimum,
    }: {
      productId: string;
      minimum: number;
    }) => inventoryService.setMinimum(productId, minimum),
    onSuccess: (item) => {
      toast.success(`${item.name}: reorder level set to ${item.minimum}`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
