'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  Flag,
  Loader2,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import {
  useAdminReviews,
  useDeleteReview,
  useHideReview,
  useUnhideReview,
} from '@/hooks/use-reviews';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Review, ReviewStatus } from '@/types';

const STATUS_OPTIONS: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'HIDDEN', label: 'Hidden' },
];

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-200 text-neutral-600',
      )}
    >
      {status === 'PUBLISHED' ? 'Published' : 'Hidden'}
    </span>
  );
}

function ReportsCell({ review }: { review: Review }) {
  const count = review._count?.reports ?? 0;
  if (count === 0) return <span className="text-[#B8B4A8]">—</span>;

  const reasons = (review.reports ?? []).map((r) => r.reason).join('\n');
  return (
    <span
      title={reasons}
      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
    >
      <Flag size={11} aria-hidden />
      {count}
    </span>
  );
}

export default function AdminReviewsPage() {
  const { user, isAuthenticated } = useAuthStore();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const { data, isLoading, isError } = useAdminReviews({
    page,
    search: search.trim() || undefined,
    status: status || undefined,
    // The admin's own "reported" queue on the sidebar is a separate endpoint;
    // this toggle just applies the same filter within this page's table.
    productId: undefined,
  });
  const hideReview = useHideReview();
  const unhideReview = useUnhideReview();
  const deleteReview = useDeleteReview();



  const hasFilters = Boolean(search || status || reportedOnly);
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setReportedOnly(false);
    setPage(1);
  };

  // reportedOnly is applied client-side against the already-fetched page
  // rather than a second query, since it's just a further narrowing of the
  // same admin/all listing (reported reviews are a subset, not a different
  // collection) — the dedicated /admin/reported endpoint backs the sidebar
  // badge instead, where an independent, page-1-only count is what's needed.
  const rows = reportedOnly
    ? (data?.reviews ?? []).filter((r) => (r._count?.reports ?? 0) > 0)
    : (data?.reviews ?? []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
            Reviews
          </h1>
          <p className="mt-0.5 text-[13px] text-[#928E82]">
            {data ? `${data.pagination.total} review${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* ─── Filters ────────────────────────────────────────────────────── */}
      <div className="mb-4 space-y-2">
        <div className="relative w-full">
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
            placeholder="Search by product name…"
            className="w-full rounded-lg border border-[#EAE8E1] bg-white py-2 pl-9 pr-3 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReviewStatus | '');
              setPage(1);
            }}
            className="h-[38px] flex-1 sm:flex-none rounded-lg border border-[#EAE8E1] bg-white px-2.5 text-[13px] text-[#0F0F0F] outline-none focus:border-[#0F0F0F]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setReportedOnly((v) => !v)}
            className={cn(
              'inline-flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-all',
              reportedOnly
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-[#EAE8E1] bg-white text-[#6E6A5E] hover:border-[#D5D2C8]',
            )}
          >
            <Flag size={13} aria-hidden />
            Reported only
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
      </div>

      {/* ─── Main Content: Dual Mobile / Desktop Presentation ──────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Loading reviews…
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-[#CC0000]">Could not load reviews.</p>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-sm text-[#928E82]">
            {hasFilters ? 'No reviews match these filters.' : 'No reviews yet.'}
          </p>
        ) : (
          <>
            {/* 📱 MOBILE VIEW: High-Density Review Cards (< md) */}
            <div className="divide-y divide-[#F4F3EF] md:hidden">
              {rows.map((review) => (
                <article key={review.id} className="p-4 transition-colors hover:bg-[#FAFAF8]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {review.product ? (
                        <Link
                          href={`/products/${review.product.slug}`}
                          target="_blank"
                          className="font-medium text-xs text-[#0F0F0F] hover:underline truncate block"
                        >
                          {review.product.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-[#928E82]">—</span>
                      )}
                      <p className="mt-0.5 text-xs text-[#6E6A5E] flex items-center gap-1">
                        <span>{review.user ? `${review.user.firstName} ${review.user.lastName}` : 'Anonymous'}</span>
                        {review.isVerifiedPurchase && (
                          <ShieldCheck size={11} className="text-emerald-600" />
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-semibold text-xs text-[#0F0F0F]">
                        ⭐ {review.rating}/5
                      </span>
                      <StatusBadge status={review.status} />
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="mt-2 text-xs font-semibold text-[#0F0F0F]">
                      {review.title}
                    </h4>
                  )}

                  {review.comment && (
                    <p className="mt-1 text-xs text-[#4A4740] line-clamp-3">
                      {review.comment}
                    </p>
                  )}

                  {review.images && review.images.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
                      {review.images.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#EAE8E1]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Review photo" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-[#F4F3EF] pt-2.5 text-xs">
                    <div className="flex items-center gap-2 text-[#928E82]">
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                      <ReportsCell review={review} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {review.status === 'PUBLISHED' ? (
                        <button
                          onClick={() => hideReview.mutate(review.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#EAE8E1] px-2.5 py-1 text-xs text-[#6E6A5E] hover:bg-neutral-100"
                        >
                          <EyeOff size={12} />
                          Hide
                        </button>
                      ) : (
                        <button
                          onClick={() => unhideReview.mutate(review.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#EAE8E1] px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          <Eye size={12} />
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(review)}
                        className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                        aria-label="Delete review"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* 💻 DESKTOP VIEW: Full Data Table (≥ md) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#EAE8E1] bg-[#FAFAF8]">
                    {['Product', 'Customer', 'Rating', 'Title', 'Photos', 'Status', 'Reports', 'Date', ''].map(
                      (h) => (
                        <th
                          key={h || 'actions'}
                          className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#928E82]"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((review) => (
                    <tr key={review.id} className="border-b border-[#F2F1EC] last:border-b-0">
                      <td className="max-w-[220px] truncate px-4 py-3 text-[13px] text-[#0F0F0F]">
                        {review.product ? (
                          <Link
                            href={`/products/${review.product.slug}`}
                            target="_blank"
                            className="hover:underline"
                          >
                            {review.product.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#0F0F0F]">
                        <span className="inline-flex items-center gap-1">
                          {review.user ? `${review.user.firstName} ${review.user.lastName}` : '—'}
                          {review.isVerifiedPurchase && (
                            <ShieldCheck size={12} className="text-emerald-600" aria-hidden />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-[#0F0F0F]">
                        {review.rating}/5
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[13px] text-[#0F0F0F]">
                        {review.title}
                      </td>
                      <td className="px-4 py-3">
                        {review.images.length > 0 ? (
                          <div className="flex -space-x-2">
                            {review.images.slice(0, 3).map((url) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setLightboxUrl(url)}
                                className="h-7 w-7 overflow-hidden rounded-full border-2 border-white shadow-sm"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="Review photo" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#B8B4A8]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={review.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ReportsCell review={review} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#928E82]">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {review.status === 'PUBLISHED' ? (
                            <button
                              onClick={() => hideReview.mutate(review.id)}
                              title="Hide review"
                              className="rounded-md p-1.5 text-[#928E82] transition-colors hover:bg-neutral-100 hover:text-[#0F0F0F]"
                            >
                              <EyeOff size={14} aria-hidden />
                            </button>
                          ) : (
                            <button
                              onClick={() => unhideReview.mutate(review.id)}
                              title="Unhide review"
                              className="rounded-md p-1.5 text-[#928E82] transition-colors hover:bg-neutral-100 hover:text-[#0F0F0F]"
                            >
                              <Eye size={14} aria-hidden />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(review)}
                            title="Delete review"
                            className="rounded-md p-1.5 text-[#928E82] transition-colors hover:bg-red-50 hover:text-[#CC0000]"
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ─── Paging ─────────────────────────────────────────────────────── */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-[#928E82]">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} reviews
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Review photo, enlarged"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#0F0F0F]">Delete this review?</h3>
            <p className="mt-1.5 text-[13px] text-[#6E6A5E]">
              "{deleteTarget.title}" will be permanently removed. This can't be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#EAE8E1] bg-white px-3 py-1.5 text-[13px] font-medium text-[#0F0F0F] hover:border-[#D5D2C8]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteReview.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-lg bg-[#CC0000] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#A80000]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
