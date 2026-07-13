'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, TriangleAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdjustStock } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';
import { ADJUSTMENT_OPTIONS, AdjustmentType, InventoryItem } from '@/types/inventory';

/**
 * The stock adjustment dialog (plan Session 5.1, task 3).
 *
 * The design problem here is that a stock adjustment is IRREVERSIBLE in the sense
 * that matters: it writes a permanent row into an append-only ledger. You cannot
 * un-damage cloth. So the dialog is built around one idea — SHOW THE ADMIN THE
 * RESULT BEFORE THEY COMMIT TO IT. The preview is not decoration; it is the whole
 * feature. A number typed into a box is an intention, and an intention is exactly
 * the thing that gets a sign backwards.
 *
 * BR4 is mirrored here so the failure is visible BEFORE the click, not returned as
 * a red toast after it. The server remains the real gate — this is a courtesy, not
 * a control, and the code says so.
 */
export function AdjustDialog({
  item,
  open,
  onClose,
}: {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<AdjustmentType>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  const adjust = useAdjustStock();

  if (!item) return null;

  const option = ADJUSTMENT_OPTIONS.find((o) => o.value === type)!;
  const magnitude = Number.parseInt(quantity, 10);
  const hasQuantity = Number.isFinite(magnitude) && magnitude !== 0;

  /**
   * The signed change. PURCHASE always adds and DAMAGE always removes — the sign is
   * a property of the TYPE, not something the admin should have to remember to
   * type. Only a correction can go either way, and there the admin picks.
   */
  const change =
    option.direction === 'up'
      ? Math.abs(magnitude)
      : option.direction === 'down'
        ? -Math.abs(magnitude)
        : magnitude;

  const resulting = item.available + (hasQuantity ? change : 0);
  const resultingSellable = resulting - item.reserved;

  // The two floors, in the same order the server checks them.
  const belowZero = hasQuantity && resulting < 0;
  const belowReserved = hasQuantity && !belowZero && resulting < item.reserved;
  const blocked = belowZero || belowReserved;

  const willBeLow = !blocked && hasQuantity && resulting <= item.minimum;

  function reset() {
    setType('PURCHASE');
    setQuantity('');
    setNote('');
  }

  function submit() {
    if (!hasQuantity || blocked || !item) return;

    adjust.mutate(
      { productId: item.productId, change, type, note: note.trim() || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md border-[#EAE8E1] p-0">
        <div className="border-b border-[#EAE8E1] px-6 pb-4 pt-6">
          <DialogTitle className="text-[15px] font-semibold text-[#0F0F0F]">
            Adjust stock
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-[#928E82]">
            {item.name} · {item.sku}
          </DialogDescription>
        </div>

        <div className="space-y-5 px-6">
          {/* ─── Why ─────────────────────────────────────────────────────── */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
              Reason
            </legend>

            <div className="grid grid-cols-3 gap-1.5">
              {ADJUSTMENT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setType(o.value)}
                  aria-pressed={type === o.value}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-[11px] font-medium transition-all',
                    type === o.value
                      ? 'border-[#0F0F0F] bg-[#0F0F0F] text-white shadow-sm'
                      : 'border-[#EAE8E1] bg-white text-[#6E6A5E] hover:border-[#D5D2C8]',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[#928E82]">{option.hint}</p>
          </fieldset>

          {/* ─── How many ────────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="qty"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]"
            >
              {option.direction === 'both' ? 'Change (+ or −)' : 'Quantity'}
            </label>
            <input
              id="qty"
              type="number"
              inputMode="numeric"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={option.direction === 'both' ? 'e.g. −4' : 'e.g. 50'}
              className="w-full rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 font-display text-lg font-semibold tabular-nums text-[#0F0F0F] outline-none transition-colors placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
            />
          </div>

          {/* ─── THE PREVIEW ─────────────────────────────────────────────────
              Everything above is input; this is the part that prevents mistakes. */}
          <div
            className={cn(
              'rounded-xl border p-4 transition-colors',
              blocked
                ? 'border-[#CC0000]/30 bg-[#FFF5F5]'
                : 'border-[#EAE8E1] bg-[#FAFAF8]',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
                  Now
                </p>
                <p className="font-display text-2xl font-bold tabular-nums text-[#928E82]">
                  {item.available}
                </p>
              </div>

              <ArrowRight
                size={16}
                aria-hidden
                className={cn(
                  'shrink-0',
                  hasQuantity ? 'text-[#0F0F0F]' : 'text-[#D5D2C8]',
                )}
              />

              <div className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
                  After
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    !hasQuantity
                      ? 'text-[#D5D2C8]'
                      : blocked
                        ? 'text-[#CC0000]'
                        : 'text-[#0F0F0F]',
                  )}
                >
                  {hasQuantity ? resulting : '—'}
                </p>
              </div>

              <div className="h-9 w-px bg-[#EAE8E1]" aria-hidden />

              <div className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
                  Sellable
                </p>
                <p
                  className={cn(
                    'font-display text-2xl font-bold tabular-nums',
                    !hasQuantity
                      ? 'text-[#D5D2C8]'
                      : blocked
                        ? 'text-[#CC0000]'
                        : 'text-[#0F0F0F]',
                  )}
                >
                  {hasQuantity ? Math.max(0, resultingSellable) : '—'}
                </p>
              </div>
            </div>

            {item.reserved > 0 && (
              <p className="mt-3 border-t border-[#EAE8E1] pt-2.5 text-[11px] text-[#928E82]">
                {item.reserved} unit{item.reserved === 1 ? ' is' : 's are'} reserved
                for orders already placed and cannot be written off.
              </p>
            )}
          </div>

          {/* BR4, stated in the admin's language rather than the database's. */}
          {blocked && (
            <p className="flex items-start gap-2 text-xs font-medium text-[#CC0000]">
              <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
              {belowZero
                ? `That would leave ${resulting} in stock. Stock cannot go below zero.`
                : `That would leave ${resulting} available, but ${item.reserved} are already promised to customers.`}
            </p>
          )}

          {willBeLow && (
            <p className="flex items-start gap-2 text-xs text-[#8A6A17]">
              <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
              This drops to or below the reorder level of {item.minimum}. You will
              get a low-stock alert.
            </p>
          )}

          {/* ─── Why, in words ───────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="note"
              className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]"
            >
              Note{' '}
              <span className="font-normal normal-case tracking-normal text-[#B8B4A8]">
                {type === 'DAMAGE' ? '· strongly recommended' : '· optional'}
              </span>
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder={
                type === 'DAMAGE'
                  ? '3 metres water-damaged, back store'
                  : 'Delivery from Kandy Mills'
              }
              className="w-full rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-sm text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]"
            />
            {/* An unexplained write-off is indistinguishable from theft, and this
                note is the only thing that will still be there in six months. */}
            {type === 'DAMAGE' && (
              <p className="mt-1.5 text-[11px] text-[#928E82]">
                This is permanent and goes on the record against your name.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EAE8E1] bg-[#FAFAF8] px-6 py-4">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6E6A5E] transition-colors hover:bg-[#EAE8E1]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!hasQuantity || blocked || adjust.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all',
              'bg-[#0F0F0F] hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D5D2C8]',
              // A write-off is destructive. It gets the brand's danger colour, so
              // the button never looks the same as "receive a delivery".
              type === 'DAMAGE' &&
                !blocked &&
                hasQuantity &&
                'bg-[#CC0000] hover:bg-[#A80000]',
            )}
          >
            {adjust.isPending && (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            )}
            {type === 'DAMAGE' ? 'Write off' : 'Apply'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
