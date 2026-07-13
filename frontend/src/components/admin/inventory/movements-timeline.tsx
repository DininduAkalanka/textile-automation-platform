'use client';

import { Loader2, PackageCheck, PackageX, RotateCcw, ShoppingCart, Sparkles, Wrench } from 'lucide-react';

import { useMovements } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';
import { MOVEMENT_LABEL, MovementType } from '@/types/inventory';

const ICON: Record<MovementType, typeof ShoppingCart> = {
  INITIAL: Sparkles,
  RESERVE: ShoppingCart,
  RELEASE: RotateCcw,
  SALE: PackageCheck,
  PURCHASE: PackageCheck,
  ADJUSTMENT: Wrench,
  DAMAGE: PackageX,
};

/**
 * The audit ledger for one product.
 *
 * The acceptance criterion for this whole phase is that "every movement traces to
 * an order or an admin", so the ATTRIBUTION is not a footnote here — it sits on
 * the same line as the number. "Stock went down by 5" is not an audit trail.
 * "Sold −5, order TXL-20260712-0031, 3:04pm" is.
 *
 * Newest first: when something is wrong with the stock of a product, the question
 * is always "what just happened", never "what happened first".
 */
export function MovementsTimeline({ productId }: { productId: string }) {
  const { data, isLoading, isError } = useMovements(productId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-6 py-8 text-xs text-[#928E82]">
        <Loader2 size={13} className="animate-spin" aria-hidden />
        Loading the ledger…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="px-6 py-8 text-xs text-[#CC0000]">
        Could not load this product&apos;s history.
      </p>
    );
  }

  if (data.items.length === 0) {
    return (
      <p className="px-6 py-8 text-xs text-[#928E82]">
        No movements recorded yet.
      </p>
    );
  }

  return (
    <div className="bg-[#FAFAF8] px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
          Stock history
        </h3>
        <p className="text-[11px] text-[#B8B4A8]">
          {data.pagination.total} movement
          {data.pagination.total === 1 ? '' : 's'}
        </p>
      </div>

      <ol className="relative space-y-0">
        {/* The spine. A timeline without one is just a list. */}
        <span
          aria-hidden
          className="absolute bottom-4 left-[11px] top-4 w-px bg-[#EAE8E1]"
        />

        {data.items.map((movement) => {
          const Icon = ICON[movement.type];
          const up = movement.quantityChange > 0;

          // Exactly one of these is set. INITIAL has neither — it IS the beginning.
          const who =
            movement.orderNumber ??
            (movement.adminName ? `by ${movement.adminName}` : null);

          return (
            <li key={movement.id} className="relative flex gap-3 py-2.5">
              <span
                className={cn(
                  'relative z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full ring-4 ring-[#FAFAF8]',
                  movement.type === 'DAMAGE'
                    ? 'bg-[#CC0000] text-white'
                    : up
                      ? 'bg-[#0F0F0F] text-white'
                      : 'bg-[#EAE8E1] text-[#6E6A5E]',
                )}
              >
                <Icon size={11} strokeWidth={2} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-xs font-medium text-[#0F0F0F]">
                    {MOVEMENT_LABEL[movement.type]}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 font-display text-xs font-bold tabular-nums',
                      movement.type === 'DAMAGE'
                        ? 'text-[#CC0000]'
                        : up
                          ? 'text-emerald-700'
                          : 'text-[#6E6A5E]',
                    )}
                  >
                    {up ? '+' : ''}
                    {movement.quantityChange}
                  </span>
                </div>

                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#928E82]">
                  {who && (
                    <span
                      className={cn(
                        movement.orderNumber &&
                          'font-medium tabular-nums text-[#6E6A5E]',
                      )}
                    >
                      {who}
                    </span>
                  )}
                  {who && <span aria-hidden>·</span>}
                  <time dateTime={movement.createdAt}>
                    {new Date(movement.createdAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </p>

                {movement.note && (
                  <p className="mt-1 border-l-2 border-[#EAE8E1] pl-2 text-[11px] italic text-[#6E6A5E]">
                    {movement.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {data.pagination.totalPages > 1 && (
        <p className="mt-3 border-t border-[#EAE8E1] pt-3 text-[11px] text-[#B8B4A8]">
          Showing the {data.items.length} most recent of{' '}
          {data.pagination.total}.
        </p>
      )}
    </div>
  );
}
