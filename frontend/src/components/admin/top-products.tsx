'use client';

import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Product {
  productId: string;
  name: string;
  quantity: number;
  revenue: string;
}

/**
 * Best sellers, as a horizontal bar list.
 *
 * NOT a Recharts bar chart, deliberately. For 5 ranked items the label matters
 * more than the geometry, and a vertical bar chart forces product names to be
 * truncated or rotated to be read. A horizontal list gives the name full width,
 * the bar gives instant magnitude comparison, and the figure stays exact. Charts
 * are for trends; rankings are lists.
 */
export function TopProducts({ products }: { products: Product[] }) {
  const max = Math.max(...products.map((p) => Number(p.revenue)), 1);

  return (
    <div className="h-full rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <h2 className="text-[13px] font-semibold tracking-tight text-[#0F0F0F]">
        Top products
      </h2>
      <p className="mb-5 mt-0.5 text-[11px] text-[#928E82]">
        By revenue, last 30 days
      </p>

      {products.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#928E82]">
          No sales in this period.
        </p>
      ) : (
        <ol className="space-y-4">
          {products.map((product, index) => {
            const revenue = Number(product.revenue);
            const lead = index === 0;

            return (
              <li key={product.productId}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      className={cn(
                        'text-[10px] font-bold tabular-nums',
                        // The leader gets the gold. Rank should be legible without
                        // counting rows.
                        lead ? 'text-[#D4AF37]' : 'text-[#D5D2C8]',
                      )}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-xs font-medium text-[#0F0F0F]">
                      {product.name}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-xs font-bold tabular-nums text-[#0F0F0F]">
                    {formatLKR(revenue)}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#F4F3EF]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#E60000] to-[#A80000]"
                      style={{
                        width: `${Math.max(4, (revenue / max) * 100)}%`,
                        // Rank fades. Information, not decoration.
                        opacity: 1 - index * 0.16,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[#B8B4A8]">
                    {product.quantity}×
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
