'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import { Category } from '@/types';

const inputClass =
  'w-full rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]';
const labelClass =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]';

/**
 * Create/rename a category, and optionally set its parent (plan Session 2.2,
 * task 2). The parent field is hidden, not just disabled, when the category
 * being edited already has children of its own — nesting it under anything
 * else would make a depth-3 branch, which updateCategory() already refuses,
 * so the form explains that up front instead of letting the admin hit a 409.
 *
 * This outer component owns only the Dialog shell; CategoryFormInner is
 * mounted fresh (keyed by category id) each time it opens, so every field
 * starts correct via a lazy useState initializer rather than an effect that
 * calls setState on open (see product-form-dialog.tsx for the same fix and
 * the lint rule — react-hooks/set-state-in-effect — that requires it).
 */
export function CategoryFormDialog({
  category,
  initialParentId,
  categories,
  open,
  onClose,
}: {
  category: Category | null;
  initialParentId?: string | null;
  categories: Category[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm border-[#EAE8E1] p-0">
        {open && (
          <CategoryFormInner
            key={category?.id ?? 'create'}
            category={category}
            initialParentId={initialParentId}
            categories={categories}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryFormInner({
  category,
  initialParentId,
  categories,
  onClose,
}: {
  category: Category | null;
  initialParentId?: string | null;
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [parentId, setParentId] = useState(
    category ? (category.parentId ?? '') : (initialParentId ?? ''),
  );

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const isEdit = category !== null;
  const busy = createCategory.isPending || updateCategory.isPending;
  
  // Calculate depth requirements
  const categoryChildren = categories.filter(c => c.parentId === category?.id);
  const hasChildren = categoryChildren.length > 0;
  const hasGrandchildren = categoryChildren.some(child => 
    categories.some(grandchild => grandchild.parentId === child.id)
  );

  function getDepth(catId: string): number {
    let depth = 1;
    let currentId = catId;
    while(true) {
      const parent = categories.find(c => c.id === currentId)?.parentId;
      if (!parent) break;
      depth++;
      currentId = parent;
    }
    return depth;
  }

  const parentOptions = categories.filter((c) => {
    if (c.id === category?.id) return false;
    
    let isDescendant = false;
    let p = c.parentId;
    while(p) {
      if (p === category?.id) { isDescendant = true; break; }
      p = categories.find(parent => parent.id === p)?.parentId;
    }
    if (isDescendant) return false;

    const targetDepth = getDepth(c.id);
    if (hasGrandchildren) return false; 
    if (hasChildren && targetDepth >= 2) return false; 
    if (targetDepth >= 3) return false; 
    
    return true;
  });

  const valid = name.trim() !== '';

  function submit() {
    if (!valid) return;

    if (isEdit) {
      updateCategory.mutate(
        {
          id: category.id,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            parentId: hasGrandchildren ? undefined : parentId || null,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createCategory.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          parentId: parentId || undefined,
        },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <>
      <div className="border-b border-[#EAE8E1] px-6 pb-4 pt-6">
        <DialogTitle className="text-[15px] font-semibold text-[#0F0F0F]">
          {isEdit ? `Edit ${category.name}` : 'New category'}
        </DialogTitle>
        <DialogDescription className="mt-0.5 text-xs text-[#928E82]">
          {isEdit ? 'Rename, describe, or move it.' : 'Categories nest up to three levels deep.'}
        </DialogDescription>
      </div>

      <div className="space-y-4 px-6 py-4">
        <div>
          <label className={labelClass} htmlFor="cf-name">Name</label>
          <input
            id="cf-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="School Uniforms"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="cf-desc">Description</label>
          <textarea
            id="cf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="cf-image">Image URL</label>
          <input
            id="cf-image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </div>

        {hasGrandchildren ? (
          <p className="rounded-lg bg-[#FAFAF8] px-3 py-2.5 text-[12px] text-[#928E82]">
            This category has children and grandchildren, so it cannot be
            nested under another category.
          </p>
        ) : (
          <div>
            <label className={labelClass} htmlFor="cf-parent">Parent</label>
            <select
              id="cf-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputClass}
            >
              <option value="">No parent (top-level)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {getDepth(c.id) > 1 ? '— ' : ''}{c.name}
                </option>
              ))}
            </select>
            {hasChildren && <p className="mt-2 text-[11px] text-[#928E82]">This category has sub-categories, so it can only be nested under a top-level category.</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-[#EAE8E1] bg-[#FAFAF8] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6E6A5E] transition-colors hover:bg-[#EAE8E1]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !valid}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0F0F0F] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D5D2C8]"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {isEdit ? 'Save changes' : 'Create category'}
        </button>
      </div>
    </>
  );
}
