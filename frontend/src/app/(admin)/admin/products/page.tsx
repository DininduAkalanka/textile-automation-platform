'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, Loader2, MoreVertical, Pencil, Plus, RotateCcw, Search, Trash2, TriangleAlert, X } from 'lucide-react';

import { ProductFormDialog } from '@/components/admin/products/product-form-dialog';
import { useCategories } from '@/hooks/use-categories';
import {
  useAdminProducts,
  useArchiveProduct,
  useDeleteProduct,
  useProductDeletionCheck,
  useRestoreProduct,
} from '@/hooks/use-products';
import { categorySelectOptions } from '@/lib/category-tree';
import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Product, ProductType } from '@/types';

const TYPE_OPTIONS: { value: ProductType | ''; label: string }[] = [
  { value: '', label: 'Any type' },
  { value: 'READY_MADE', label: 'Ready-made' },
  { value: 'UNIFORM', label: 'Uniform' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'ACCESSORY', label: 'Accessory' },
];

/**
 * Admin catalog table (plan Session 2.2, task 1).
 *
 * The one visibility decision that matters: this hits /products/admin/all,
 * which defaults to the SAME "active only" view the storefront has, plus an
 * "Archived" toggle that reaches the products the public list can never show
 * again. Before this session there was no way back to an archived product at
 * all — this page's whole reason to exist is that escape hatch.
 */
export default function AdminProductsPage() {
  const { user, isAuthenticated } = useAuthStore();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  // undefined = closed, null = create mode, a Product = edit mode.
  const [formTarget, setFormTarget] = useState<Product | null | undefined>(undefined);
  // The product queued for permanent deletion (drives the confirm modal).
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useAdminProducts({
    page,
    search: search.trim() || undefined,
    categoryId: categoryId || undefined,
    productType: productType || undefined,
    archivedOnly,
    lowStockOnly,
  });
  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const deleteProduct = useDeleteProduct();

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

  const hasFilters = Boolean(search || categoryId || productType || archivedOnly || lowStockOnly);

  function clearFilters() {
    setSearch('');
    setCategoryId('');
    setProductType('');
    setArchivedOnly(false);
    setLowStockOnly(false);
    setPage(1);
  }

  const categoryOptions = categorySelectOptions(categories ?? []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
            Products
          </h1>
          <p className="mt-0.5 text-[13px] text-[#928E82]">
            {data ? `${data.pagination.total} product${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>

        <button
          onClick={() => setFormTarget(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F0F0F] px-3.5 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black"
        >
          <Plus size={14} aria-hidden />
          New product
        </button>
      </div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#B8B4A8]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, SKU or description…"
            className="w-full rounded-lg border border-[#EAE8E1] bg-white py-2 pl-9 pr-3 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
        >
          <option value="">Any category</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={productType}
          onChange={(e) => {
            setProductType(e.target.value as ProductType | '');
            setPage(1);
          }}
          className="h-[38px] rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setLowStockOnly((v) => !v);
            setPage(1);
          }}
          className={cn(
            'inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-all',
            lowStockOnly
              ? 'border-[#CC0000] bg-[#CC0000] text-white'
              : 'border-[#EAE8E1] bg-white text-[#6E6A5E] hover:border-[#D5D2C8]',
          )}
        >
          <TriangleAlert size={13} aria-hidden />
          Low stock
        </button>

        <button
          onClick={() => {
            setArchivedOnly((v) => !v);
            setPage(1);
          }}
          className={cn(
            'inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-all',
            archivedOnly
              ? 'border-[#0F0F0F] bg-[#0F0F0F] text-white'
              : 'border-[#EAE8E1] bg-white text-[#6E6A5E] hover:border-[#D5D2C8]',
          )}
        >
          <Archive size={13} aria-hidden />
          Archived
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-[#EAE8E1] bg-white px-2.5 py-2 text-[12px] font-medium text-[#928E82] transition-colors hover:border-[#D5D2C8] hover:text-[#0F0F0F]"
          >
            <X size={12} aria-hidden />
            Clear
          </button>
        )}
      </div>

      {/* ─── The table ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading products…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-[#CC0000]">Could not load products.</p>
        ) : !data || data.products.length === 0 ? (
          <p className="py-20 text-center text-sm text-[#928E82]">
            {hasFilters ? 'No products match these filters.' : 'No products yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EAE8E1] bg-[#FAFAF8]">
                  {['Product', 'Category', 'Type', 'Price', 'Stock', 'Status', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#928E82]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-[#F4F3EF] transition-colors hover:bg-[#FAFAF8]"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setFormTarget(product)}
                        className="text-left"
                      >
                        <span className="block truncate text-[13px] font-medium text-[#0F0F0F] hover:underline">
                          {product.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-[#B8B4A8]">
                          {product.sku}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6E6A5E]">
                      {product.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#928E82]">
                      {product.productType?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-display text-[13px] font-semibold tabular-nums text-[#0F0F0F]">
                      {formatLKR(product.price)}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-[#4A4740]">
                      {product.stockQuantity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                          product.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-[#F4F3EF] text-[#6E6A5E]',
                        )}
                      >
                        {product.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setFormTarget(product)}
                          aria-label="Edit"
                          className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F]"
                        >
                          <Pencil size={13} aria-hidden />
                        </button>
                        <RowActionsMenu
                          isActive={product.isActive}
                          busy={archiveProduct.isPending || restoreProduct.isPending}
                          onArchive={() => archiveProduct.mutate(product.id)}
                          onRestore={() => restoreProduct.mutate(product.id)}
                          onDelete={() => setDeleteTarget(product)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Paging ───────────────────────────────────────────────────────── */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-[#928E82]">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} products
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] transition-colors hover:border-[#D5D2C8] disabled:cursor-not-allowed disabled:text-[#D5D2C8]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] transition-colors hover:border-[#D5D2C8] disabled:cursor-not-allowed disabled:text-[#D5D2C8]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ProductFormDialog
        product={formTarget ?? null}
        open={formTarget !== undefined}
        onClose={() => setFormTarget(undefined)}
      />

      {deleteTarget && (
        <DeleteProductDialog
          product={deleteTarget}
          deleting={deleteProduct.isPending}
          archiving={archiveProduct.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteProduct.mutate(
              { id: deleteTarget.id, name: deleteTarget.name },
              { onSuccess: () => setDeleteTarget(null) },
            )
          }
          onArchiveInstead={() =>
            archiveProduct.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        />
      )}
    </div>
  );
}

/**
 * Row overflow menu (the "⋮"). Edit stays inline in the row; the two lifecycle
 * actions — Archive/Restore and the destructive Delete — live one deliberate
 * tap in here, so a permanent delete is never adjacent to a routine click.
 *
 * The panel is positioned `fixed` from the trigger's own rect rather than
 * absolutely inside the cell: the table scrolls under `overflow`, which would
 * otherwise clip a dropdown. A full-screen transparent backdrop handles
 * click-outside and closes on the next scroll/resize so it can't drift.
 */
function RowActionsMenu({
  isActive,
  busy,
  onArchive,
  onRestore,
  onDelete,
}: {
  isActive: boolean;
  busy: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Capture-phase scroll catches the table's own scroll container too.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Flip up when the row sits low enough that a downward menu would spill
      // off the viewport (the last-row bug). ~112px covers the two items +
      // divider + padding with a little slack.
      const MENU_H = 112;
      const right = window.innerWidth - rect.right;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPos(
        spaceBelow < MENU_H + 12
          ? { bottom: window.innerHeight - rect.top + 6, right }
          : { top: rect.bottom + 6, right },
      );
    }
    setOpen((v) => !v);
  }

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={busy}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <MoreVertical size={13} aria-hidden />
        )}
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
            className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[#EAE8E1] bg-white py-1 shadow-lg"
          >
            {isActive ? (
              <MenuItem icon={<Archive size={14} aria-hidden />} onClick={run(onArchive)}>
                Archive
              </MenuItem>
            ) : (
              <MenuItem icon={<RotateCcw size={14} aria-hidden />} onClick={run(onRestore)}>
                Restore
              </MenuItem>
            )}
            <div className="my-1 h-px bg-[#F4F3EF]" />
            <MenuItem
              icon={<Trash2 size={14} aria-hidden />}
              onClick={run(onDelete)}
              destructive
            >
              Delete permanently
            </MenuItem>
          </div>
        </>
      )}
    </>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors',
        destructive
          ? 'text-[#CC0000] hover:bg-[#FFF0F0]'
          : 'text-[#4A4740] hover:bg-[#FAFAF8]',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Delete/retire confirmation. It first asks the server whether this product can
 * even be deleted (no order history), and reshapes itself around the answer:
 *
 *  • checking … → a quiet loading line, both actions held back.
 *  • deletable  → the real "erase for good" warning + a red Delete button.
 *  • sold       → NOT a dead end: it explains the product is in N orders, drops
 *                 the delete affordance entirely, and makes Archive the primary
 *                 action right here — so the owner completes the retire in one
 *                 place instead of bouncing off a red error toast.
 *
 * The server still enforces the rule (this is the friendly front of the same
 * guard, not a replacement for it).
 */
function DeleteProductDialog({
  product,
  deleting,
  archiving,
  onCancel,
  onConfirm,
  onArchiveInstead,
}: {
  product: Product;
  deleting: boolean;
  archiving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onArchiveInstead: () => void;
}) {
  const { data, isLoading, isError } = useProductDeletionCheck(product.id);
  const busy = deleting || archiving;
  // Until we know otherwise, assume the safe answer (only archive) so a slow
  // check never briefly offers a delete it will then retract.
  const deletable = data?.deletable === true;
  const orderCount = data?.orderCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              deletable ? 'bg-[#FFF0F0] text-[#CC0000]' : 'bg-[#FBF3E4] text-[#8F711D]',
            )}
          >
            {deletable ? <Trash2 size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#0F0F0F]">
            {isLoading || isError
              ? 'Delete product?'
              : deletable
                ? 'Delete permanently?'
                : 'This product can only be archived'}
          </h2>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 py-3 text-[13px] text-[#928E82]">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Checking whether this product can be deleted…
          </p>
        ) : isError ? (
          <p className="rounded-lg bg-[#FFF0F0] px-3 py-2 text-[13px] leading-relaxed text-[#A80000]">
            Couldn&apos;t check this product just now. Please close this and try
            again.
          </p>
        ) : deletable ? (
          <>
            <p className="text-[13px] leading-relaxed text-[#6E6A5E]">
              <span className="font-semibold text-[#0F0F0F]">{product.name}</span>{' '}
              has never been ordered, so it can be erased for good — this
              can&apos;t be undone.
            </p>
            <p className="mt-2 rounded-lg bg-[#FAF9F6] px-3 py-2 text-[12px] leading-relaxed text-[#6E6A5E]">
              Its product record and stock row will be removed. Nothing in any
              order or report references it.
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-[#6E6A5E]">
              <span className="font-semibold text-[#0F0F0F]">{product.name}</span>{' '}
              appears in{' '}
              <span className="font-semibold text-[#0F0F0F]">
                {orderCount} past order{orderCount === 1 ? '' : 's'}
              </span>
              , so it can&apos;t be permanently deleted — deleting it would break
              that order history, its invoices and your reports.
            </p>
            <p className="mt-2 rounded-lg bg-[#F1F7F3] px-3 py-2 text-[12px] leading-relaxed text-[#2F6B49]">
              <span className="font-semibold">Archive</span> instead: it
              disappears from the shop, all {orderCount} order
              {orderCount === 1 ? '' : 's'} stay intact, and you can restore it
              anytime.
            </p>
          </>
        )}

        {!isLoading && (
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg border border-[#EAE8E1] bg-white px-3.5 py-2 text-[13px] font-medium text-[#6E6A5E] transition-colors hover:border-[#D5D2C8] hover:text-[#0F0F0F] disabled:opacity-40"
            >
              Cancel
            </button>

            {isError ? null : deletable ? (
              <button
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#CC0000] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#B00000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && <Loader2 size={13} className="animate-spin" aria-hidden />}
                Delete permanently
              </button>
            ) : (
              <button
                onClick={onArchiveInstead}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F0F0F] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {archiving ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : (
                  <Archive size={13} aria-hidden />
                )}
                Archive instead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
