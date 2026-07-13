import {
  AdjustmentType,
  InventoryItem,
  InventoryPage,
  LowStockSummary,
  MovementPage,
} from '@/types/inventory';

import { http, unwrap } from './http';

export interface InventoryFilters {
  page?: number;
  search?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
}

export const inventoryService = {
  list: (filters: InventoryFilters = {}) =>
    unwrap<InventoryPage>(
      http.get('/inventory', {
        params: {
          page: filters.page,
          search: filters.search || undefined,
          categoryId: filters.categoryId || undefined,
          // Only send the flag when it is on. The API parses it strictly (the
          // string "false" is NOT false under class-transformer's implicit
          // coercion), so omitting it is safer than sending false.
          lowStockOnly: filters.lowStockOnly ? true : undefined,
        },
      }),
    ),

  /** Drives the sidebar badge and the filter chip. */
  lowStock: () => unwrap<LowStockSummary>(http.get('/inventory/low-stock')),

  movements: (productId: string, page = 1) =>
    unwrap<MovementPage>(
      http.get(`/inventory/${productId}/movements`, { params: { page } }),
    ),

  /** `change` is signed: +50 for a delivery, -3 for a damaged bolt. */
  adjust: (
    productId: string,
    change: number,
    type: AdjustmentType,
    note?: string,
  ) =>
    unwrap<InventoryItem>(
      http.put(`/inventory/${productId}/adjust`, { change, type, note }),
    ),

  setMinimum: (productId: string, minimum: number) =>
    unwrap<InventoryItem>(
      http.put(`/inventory/${productId}/minimum`, { minimum }),
    ),
};
