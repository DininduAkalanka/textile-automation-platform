'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderTree, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { CategoryFormDialog } from '@/components/admin/categories/category-form-dialog';
import { useCategories, useDeleteCategory } from '@/hooks/use-categories';
import { buildCategoryTree } from '@/lib/category-tree';
import { useAuthStore } from '@/store/useAuthStore';
import { Category } from '@/types';

/**
 * Category tree (plan Session 2.2, task 2). The API returns a flat list —
 * the tree is built here from parentId, which is simple because depth is
 * capped at 2: every category is either top-level or a direct child of one,
 * never deeper, so two nesting levels of JSX cover every case there is.
 */
export default function AdminCategoriesPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { data: categories, isLoading, isError } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [formState, setFormState] = useState<{
    category: Category | null;
    initialParentId?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-2 text-xl font-semibold">Admin access required</h2>
        <Link href="/login" className="text-[#CC0000] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  const tree = buildCategoryTree(categories ?? []);

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteCategory.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
            Categories
          </h1>
          <p className="mt-0.5 text-[13px] text-[#928E82]">
            Two levels deep — a category, and its sub-categories.
          </p>
        </div>

        <button
          onClick={() => setFormState({ category: null })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F0F0F] px-3.5 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black"
        >
          <Plus size={14} aria-hidden />
          New category
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading categories…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-[#CC0000]">
            Could not load categories.
          </p>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <FolderTree size={22} className="text-[#D5D2C8]" aria-hidden />
            <p className="text-sm text-[#928E82]">No categories yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F4F3EF]">
            {tree.map((top) => (
              <li key={top.id}>
                <CategoryRow
                  category={top}
                  onEdit={() => setFormState({ category: top })}
                  onAddChild={() =>
                    setFormState({ category: null, initialParentId: top.id })
                  }
                  onDelete={() => setDeleteTarget(top)}
                />
                {top.children.length > 0 && (
                  <ul className="divide-y divide-[#F4F3EF] bg-[#FAFAF8]">
                    {top.children.map((child) => (
                      <li key={child.id}>
                        <CategoryRow
                          category={child}
                          indented
                          onEdit={() => setFormState({ category: child })}
                          onDelete={() => setDeleteTarget(child)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CategoryFormDialog
        category={formState?.category ?? null}
        initialParentId={formState?.initialParentId}
        categories={categories ?? []}
        open={formState !== null}
        onClose={() => setFormState(null)}
      />

      {/* A category delete is not reversible the way archiving a product is
          (there is no "restore"), so — unlike the product row's archive
          button — this gets an explicit confirm step. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[15px] font-semibold text-[#0F0F0F]">
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h2>
            <p className="mt-1 text-[13px] text-[#928E82]">
              This cannot be undone. If it still has products or
              sub-categories, the delete will be refused.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6E6A5E] hover:bg-[#F4F3EF]"
              >
                Never mind
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteCategory.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#CC0000] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#A80000] disabled:cursor-not-allowed disabled:bg-[#D5D2C8]"
              >
                {deleteCategory.isPending && (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  indented,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: Category;
  indented?: boolean;
  onEdit: () => void;
  onAddChild?: () => void;
  onDelete: () => void;
}) {
  const productCount = category._count?.products ?? 0;
  const childCount = category._count?.children ?? 0;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className={indented ? 'pl-6' : ''}>
        <p className="text-[13px] font-medium text-[#0F0F0F]">
          {indented && <span className="mr-1.5 text-[#D5D2C8]">—</span>}
          {category.name}
        </p>
        <p className="text-[11px] text-[#928E82]">
          {productCount} product{productCount === 1 ? '' : 's'}
          {!indented && childCount > 0
            ? ` · ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}`
            : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onAddChild && (
          <button
            onClick={onAddChild}
            className="inline-flex items-center gap-1 rounded-lg border border-[#EAE8E1] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#6E6A5E] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
          >
            <Plus size={12} aria-hidden />
            Sub-category
          </button>
        )}
        <button
          onClick={onEdit}
          aria-label="Edit"
          className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
        >
          <Pencil size={13} aria-hidden />
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#CC0000]/40 hover:text-[#CC0000]"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
