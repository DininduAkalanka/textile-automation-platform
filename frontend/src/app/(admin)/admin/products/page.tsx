'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, Loader2, Pencil, Plus, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';

import { ProductFormDialog } from '@/components/admin/products/product-form-dialog';
import { useCategories } from '@/hooks/use-categories';
import { useAdminProducts, useArchiveProduct, useRestoreProduct } from '@/hooks/use-products';
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
                        {product.isActive ? (
                          <button
                            onClick={() => archiveProduct.mutate(product.id)}
                            disabled={archiveProduct.isPending}
                            aria-label="Archive"
                            className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#CC0000]/40 hover:text-[#CC0000] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Archive size={13} aria-hidden />
                          </button>
                        ) : (
                          <button
                            onClick={() => restoreProduct.mutate(product.id)}
                            disabled={restoreProduct.isPending}
                            aria-label="Restore"
                            className="rounded-lg border border-[#EAE8E1] bg-white p-1.5 text-[#6E6A5E] transition-colors hover:border-[#0F0F0F] hover:text-[#0F0F0F] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RotateCcw size={13} aria-hidden />
                          </button>
                        )}
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
    </div>
  );
}
