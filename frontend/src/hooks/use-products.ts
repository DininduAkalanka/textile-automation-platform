'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AdminProductsFilters,
  ProductInput,
  productsService,
} from '@/services/products.service';

export const productKeys = {
  all: ['products'] as const,
  adminList: (filters: AdminProductsFilters) =>
    ['products', 'admin', filters] as const,
  deletionCheck: (id: string) => ['products', 'deletion-check', id] as const,
};

/**
 * Whether a product can be permanently deleted (no order history) — fetched
 * lazily, only while the delete dialog is open for a given product.
 */
export function useProductDeletionCheck(id: string | null) {
  return useQuery({
    queryKey: productKeys.deletionCheck(id ?? ''),
    queryFn: () => productsService.deletionCheck(id as string),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useAdminProducts(filters: AdminProductsFilters) {
  return useQuery({
    queryKey: productKeys.adminList(filters),
    queryFn: () => productsService.listAdmin(filters),
    placeholderData: (previous) => previous, // no flicker when paging or filtering
  });
}

/**
 * A product row carries its category's name and, indirectly, a category's
 * _count.products — so any product mutation can make the categories tree
 * stale too (a new product changes a count; an edit can move a product
 * between categories). Invalidating both is the same call the inventory
 * hooks make: correctness over saving one request on a screen an admin
 * uses occasionally, not per second.
 */
function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: productKeys.all });
    // Inlined rather than importing categoryKeys.all from use-categories.ts,
    // which imports productKeys.all from here — a plain string prefix avoids
    // the circular import for a constant that will not change.
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: (data: ProductInput) => productsService.create(data),
    onSuccess: (product) => {
      toast.success(`${product.name} created`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) =>
      productsService.update(id, data),
    onSuccess: (product) => {
      toast.success(`${product.name} updated`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: (id: string) => productsService.archive(id),
    onSuccess: (product) => {
      toast.success(`${product.name} archived`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRestoreProduct() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: (id: string) => productsService.restore(id),
    onSuccess: (product) => {
      toast.success(`${product.name} restored`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Permanent delete. The success toast carries the name the caller passes in
 * (the API returns only an id), and the error toast surfaces the server's 409
 * reason verbatim — "…appears in N past orders… archive it instead" — so the
 * owner learns *why* a sold product can't be erased.
 */
export function useDeleteProduct() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) =>
      productsService.destroy(id),
    onSuccess: (_result, { name }) => {
      toast.success(`${name} deleted`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
