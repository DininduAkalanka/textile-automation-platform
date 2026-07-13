import { StockStatus } from '@/types/inventory';
import { cn } from '@/lib/utils';

/**
 * Three states, three visual weights — because they are three different problems.
 *
 * OK  is almost invisible. Most rows are fine, and a page where every row shouts
 *     is a page where nothing does.
 * LOW is amber-on-warm: act soon. It still sells while you reorder.
 * OUT is crimson, filled, and the only badge with a solid ground. You are turning
 *     customers away RIGHT NOW. That deserves the brand's loudest colour.
 */
const STYLES: Record<StockStatus, string> = {
  OK: 'bg-[#F4F3EF] text-[#6E6A5E] ring-1 ring-inset ring-[#EAE8E1]',
  LOW: 'bg-[#FDF6E7] text-[#8A6A17] ring-1 ring-inset ring-[#D4AF37]/35',
  OUT: 'bg-[#CC0000] text-white shadow-[0_1px_4px_-1px_rgba(204,0,0,0.5)]',
};

const LABELS: Record<StockStatus, string> = {
  OK: 'In stock',
  LOW: 'Low',
  OUT: 'Out of stock',
};

export function StockBadge({
  status,
  className,
}: {
  status: StockStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
        STYLES[status],
        className,
      )}
    >
      {status !== 'OK' && (
        <span
          aria-hidden
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            status === 'OUT' ? 'bg-white' : 'bg-[#D4AF37]',
            // Only OUT pulses. A page of blinking dots is noise; one blinking dot
            // is a fire.
            status === 'OUT' && 'animate-pulse',
          )}
        />
      )}
      {LABELS[status]}
    </span>
  );
}
