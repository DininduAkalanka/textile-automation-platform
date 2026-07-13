import { Category } from '@/types';

import { http, unwrap } from './http';

export interface CategoryInput {
  name: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
  imageUrl?: string;
  /** Explicit null promotes back to top-level; omitted leaves it alone. */
  parentId?: string | null;
}

export const categoriesService = {
  /** Flat list, not a tree — _count.products/_count.children is what lets
   *  the admin UI tell a leaf from a branch without a second request. */
  list: () => unwrap<Category[]>(http.get('/categories')),

  create: (data: CategoryInput) =>
    unwrap<Category>(http.post('/categories', data)),

  update: (id: string, data: CategoryUpdateInput) =>
    unwrap<Category>(http.patch(`/categories/${id}`, data)),

  /** The API refuses with a 409 (surfaced via unwrap's Error) while the
   *  category still has products or children — never a silent orphan. */
  remove: (id: string) =>
    unwrap<{ success: boolean }>(http.delete(`/categories/${id}`)),
};
