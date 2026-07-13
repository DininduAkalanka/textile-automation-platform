'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  CategoryInput,
  categoriesService,
  CategoryUpdateInput,
} from '@/services/categories.service';

export const categoryKeys = {
  all: ['categories'] as const,
  list: ['categories', 'list'] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list,
    queryFn: categoriesService.list,
  });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    // A rename changes what a product row shows for "category"; a delete or
    // reparent changes which products a category filter matches. Inlined
    // rather than importing productKeys.all from use-products.ts, which
    // imports from here — a plain string prefix avoids the circular import
    // for a constant that will not change.
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useCreateCategory() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: (data: CategoryInput) => categoriesService.create(data),
    onSuccess: (category) => {
      toast.success(`${category.name} created`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryUpdateInput }) =>
      categoriesService.update(id, data),
    onSuccess: (category) => {
      toast.success(`${category.name} updated`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCatalog();

  return useMutation({
    mutationFn: (id: string) => categoriesService.remove(id),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    // The 409 ("still has N products / sub-categories") is exactly what the
    // admin needs to see verbatim — it names what is in the way.
    onError: (error: Error) => toast.error(error.message),
  });
}
