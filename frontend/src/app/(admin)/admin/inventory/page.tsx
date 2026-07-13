'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Loader2,
  Pencil,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';

import { AdjustDialog } from '@/components/admin/inventory/adjust-dialog';
import { MovementsTimeline } from '@/components/admin/inventory/movements-timeline';
import { StockBadge } from '@/components/admin/inventory/stock-badge';
import { useInventory, useLowStock, useSetMinimum } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { InventoryItem } from '@/types/inventory';

/**
 * Stock control (plan Session 5.1, task 3).
 *
 * The table answers three questions in the order an owner actually asks them:
 * what is running out, how much of it is really MINE to sell (available minus what
 * customers have already reserved), and who last touched it.
 *
 * `available` and `sellable` are shown as separate columns on purpose. They are
 * the same number right up until the moment they are not, and the gap between them
 * is precisely the stock that an admin must not write off.
 */
export default function InventoryPage() {
  const { user, isAuthenticated } = useAuthStore();

  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [editingMinimum, setEditingMinimum] = useState<string | null>(null);
  const [minimumDraft, setMinimumDraft] = useState('');

  const { data, isLoading, isError } = useInventory({
    page,
    search: search.trim() || undefined,
    lowStockOnly,
  });
  const { data: lowStock } = useLowStock();
  const setMinimum = useSetMinimum();

  // The API is the real gate (401/403). This only stops the page flashing an empty
  // table at someone who should never have reached it.
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

  const lowCount = lowStock?.count ?? 0;

  function saveMinimum(productId: string) {
    const value = Number.parseInt(minimumDraft, 10);
    if (Number.isFinite(value) && value >= 0) {
      setMinimum.mutate({ productId, minimum: value });
    }
    setEditingMinimum(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
            Inventory
          </h1>
          <p className="mt-0.5 text-[13px] text-[#928E82]">
            Every movement is permanent and traceable to an order or a person.
          </p>
        </div>

        {lowCount > 0 && (
          <button
            onClick={() => {
              setLowStockOnly((v) => !v);
              setPage(1);
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all',
              lowStockOnly
                ? 'border-[#CC0000] bg-[#CC0000] text-white shadow-[0_2px_8px_-2px_rgba(204,0,0,0.5)]'
                : 'border-[#CC0000]/25 bg-[#FFF5F5] text-[#A80000] hover:border-[#CC0000]/50',
            )}
          >
            <TriangleAlert size={14} aria-hidden />
            {lowCount} need{lowCount === 1 ? 's' : ''} reordering
          </button>
        )}
      </div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
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
            placeholder="Search by product name or SKU…"
            className="w-full rounded-lg border border-[#EAE8E1] bg-white py-2 pl-9 pr-3 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
          />
        </div>

        {lowStockOnly && (
          <button
            onClick={() => setLowStockOnly(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-[13px] text-[#6E6A5E] transition-colors hover:border-[#D5D2C8]"
          >
            <SlidersHorizontal size={13} aria-hidden />
            Clear filter
          </button>
        )}
      </div>

      {/* ─── The table ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading stock…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-[#CC0000]">
            Could not load inventory.
          </p>
        ) : data && data.items.length === 0 ? (
          <p className="py-20 text-center text-sm text-[#928E82]">
            {lowStockOnly
              ? 'Nothing needs reordering. '
              : search
                ? 'No products match that search.'
                : 'No products yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EAE8E1] bg-[#FAFAF8]">
                  {[
                    'Product',
                    'Available',
                    'Reserved',
                    'Sellable',
                    'Reorder at',
                    'Status',
                    '',
                  ].map((heading, i) => (
                    <th
                      key={heading || i}
                      className={cn(
                        'px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#928E82]',
                        i > 0 && i < 5 && 'text-right',
                      )}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data?.items.map((item) => {
                  const open = expanded === item.productId;

                  return (
                    // A keyed Fragment, not <>: each product renders TWO rows (the
                    // product and its expanded ledger), and the shorthand cannot
                    // carry the key React needs to keep them paired across renders.
                    <Fragment key={item.productId}>
                      <tr
                        className={cn(
                          'border-b border-[#F4F3EF] transition-colors hover:bg-[#FAFAF8]',
                          open && 'bg-[#FAFAF8]',
                        )}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setExpanded(open ? null : item.productId)
                            }
                            aria-expanded={open}
                            className="group flex items-center gap-2 text-left"
                          >
                            <ChevronDown
                              size={13}
                              aria-hidden
                              className={cn(
                                'shrink-0 text-[#B8B4A8] transition-transform',
                                open && 'rotate-180 text-[#0F0F0F]',
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-medium text-[#0F0F0F] group-hover:text-black">
                                {item.name}
                              </span>
                              <span className="block truncate text-[11px] tabular-nums text-[#B8B4A8]">
                                {item.sku}
                                {item.category ? ` · ${item.category}` : ''}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right font-display text-sm font-semibold tabular-nums text-[#0F0F0F]">
                          {item.available}
                        </td>

                        {/* Reserved is greyed when zero: it is the exception, and an
                            exception that looks like every other cell is invisible. */}
                        <td
                          className={cn(
                            'px-4 py-3 text-right text-sm tabular-nums',
                            item.reserved > 0
                              ? 'font-medium text-[#8A6A17]'
                              : 'text-[#D5D2C8]',
                          )}
                        >
                          {item.reserved}
                        </td>

                        <td className="px-4 py-3 text-right font-display text-sm font-bold tabular-nums text-[#0F0F0F]">
                          {item.sellable}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {editingMinimum === item.productId ? (
                            <input
                              autoFocus
                              type="number"
                              value={minimumDraft}
                              onChange={(e) => setMinimumDraft(e.target.value)}
                              onBlur={() => saveMinimum(item.productId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveMinimum(item.productId);
                                if (e.key === 'Escape') setEditingMinimum(null);
                              }}
                              className="w-16 rounded border border-[#0F0F0F] px-2 py-1 text-right text-sm tabular-nums outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingMinimum(item.productId);
                                setMinimumDraft(String(item.minimum));
                              }}
                              className="group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm tabular-nums text-[#6E6A5E] transition-colors hover:bg-[#EAE8E1]"
                            >
                              {item.minimum}
                              <Pencil
                                size={10}
                                aria-hidden
                                className="text-[#D5D2C8] transition-colors group-hover:text-[#6E6A5E]"
                              />
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <StockBadge status={item.status} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setAdjusting(item)}
                            className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F0F0F] transition-all hover:border-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>

                      {open && (
                        <tr>
                          <td colSpan={7} className="border-b border-[#EAE8E1] p-0">
                            <MovementsTimeline productId={item.productId} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Paging ───────────────────────────────────────────────────────── */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-[#928E82]">
            Page {data.pagination.page} of {data.pagination.totalPages} ·{' '}
            {data.pagination.total} products
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

      <AdjustDialog
        item={adjusting}
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
      />
    </div>
  );
}
