import { Product, ProductsResponse, ProductType } from '@/types';

import { http, unwrap } from './http';

export interface AdminProductsFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  productType?: ProductType;
  archivedOnly?: boolean;
  lowStockOnly?: boolean;
  sortBy?: 'name' | 'price' | 'stockQuantity' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  sku: string;
  images?: string[];
  categoryId?: string;
  isActive?: boolean;
  productType?: ProductType;
  requiresMeasurement?: boolean;
  fabricType?: string;
  color?: string;
  unit?: string;
  costPrice?: number;
}

export const productsService = {
  /**
   * The whole reason this hits /products/admin/all rather than the public
   * /products: that one hardcodes isActive: true, so there is no way to ever
   * find an archived product again through it (plan Session 2.2).
   */
  listAdmin: (filters: AdminProductsFilters = {}) =>
    unwrap<ProductsResponse>(
      http.get('/products/admin/all', {
        params: {
          page: filters.page,
          limit: filters.limit,
          search: filters.search || undefined,
          categoryId: filters.categoryId || undefined,
          productType: filters.productType || undefined,
          // Sent only when true — the API parses booleans strictly (a
          // stray "false" string is truthy under implicit conversion), so
          // omitting a false flag is safer than sending it.
          archivedOnly: filters.archivedOnly ? true : undefined,
          lowStockOnly: filters.lowStockOnly ? true : undefined,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        },
      }),
    ),

  create: (data: ProductInput) =>
    unwrap<Product>(http.post('/products', data)),

  update: (id: string, data: Partial<ProductInput>) =>
    unwrap<Product>(http.patch(`/products/${id}`, data)),

  /** Soft-delete (isActive -> false). The product and its ledger survive. */
  archive: (id: string) => unwrap<Product>(http.delete(`/products/${id}`)),

  /** There is no separate "restore" endpoint — it is the same PATCH any
   *  other edit uses, just flipping isActive back on. */
  restore: (id: string) =>
    unwrap<Product>(http.patch(`/products/${id}`, { isActive: true })),
};
