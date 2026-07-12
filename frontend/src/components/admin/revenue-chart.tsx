'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatLKR } from '@/lib/format';

interface Point {
  date: string;
  revenue: string;
  orders: number;
}

/**
 * Revenue over time — the hero of the dashboard.
 *
 * Design decisions that are not decoration:
 *
 * - AREA, not line. The filled region reads as volume, which is what revenue is.
 * - The grid is horizontal only. Vertical gridlines add ink without adding
 *   information; the eye reads a trend along X and compares magnitude along Y.
 * - Axis labels are sparse (every ~5th day). A tick per day on a 30-day range is
 *   unreadable at this width and adds nothing.
 * - Y starts at zero. Truncating the axis to exaggerate a slope is the oldest lie
 *   in business charts.
 * - Crimson, because it is the brand — but as a gradient that fades out, so the
 *   chart does not shout over the numbers it exists to explain.
 */
export function RevenueChart({ points }: { points: Point[] }) {
  const data = points.map((p) => ({
    date: p.date,
    revenue: Number(p.revenue),
    orders: p.orders,
    label: new Date(p.date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    }),
  }));

  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  if (total === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-[#EAE8E1] bg-white">
        <div className="text-center">
          <p className="text-sm font-medium text-[#0F0F0F]">No paid orders yet</p>
          <p className="mt-1 text-xs text-[#928E82]">
            Revenue will chart here as orders are paid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[#0F0F0F]">
            Revenue
          </h2>
          <p className="mt-0.5 text-[11px] text-[#928E82]">
            Last 30 days · paid orders only
          </p>
        </div>
        <p className="font-display text-2xl font-bold tracking-[-0.02em] tabular-nums text-[#0F0F0F]">
          {formatLKR(total)}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
          <defs>
            {/* A deeper, longer fall-off than the default. A timid 8% fill reads as
                an accident; this reads as a deliberate mass of colour. */}
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CC0000" stopOpacity={0.28} />
              <stop offset="55%" stopColor="#CC0000" stopOpacity={0.07} />
              <stop offset="100%" stopColor="#CC0000" stopOpacity={0} />
            </linearGradient>
            {/* The line itself darkens toward the present — the eye is drawn to
                where the story ends. */}
            <linearGradient id="revenueStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E60000" />
              <stop offset="100%" stopColor="#A80000" />
            </linearGradient>
          </defs>

          {/* Warm gridlines. A cool grey rule under a warm brand is the kind of
              mismatch you feel before you can name it. */}
          <CartesianGrid strokeDasharray="2 4" stroke="#F4F3EF" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#B8B4A8' }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.floor(data.length / 6))}
            dy={4}
          />

          <YAxis
            tick={{ fontSize: 10, fill: '#B8B4A8' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />

          <Tooltip
            cursor={{ stroke: '#D5D2C8', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                // Obsidian tooltip. It belongs to the cursor, not to the page —
                // a white card on a white chart just gets lost in it.
                <div className="rounded-lg bg-[#0F0F0F] px-3 py-2 shadow-xl">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    {p.label}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-white">
                    {formatLKR(p.revenue)}
                  </p>
                  <p className="text-[11px] text-white/50">
                    {p.orders} order{p.orders === 1 ? '' : 's'}
                  </p>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="url(#revenueStroke)"
            strokeWidth={2.25}
            fill="url(#revenueFill)"
            dot={false}
            activeDot={{
              r: 4,
              fill: '#CC0000',
              stroke: '#fff',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
