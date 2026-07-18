'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { ProductForecast } from '@/types';

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-[#EDF7F1] text-[#2F6B49]',
  medium: 'bg-[#FBF3E4] text-[#8F711D]',
  low: 'bg-[#FFF0F0] text-[#A80000]',
};

// Plain-language reliability, not statistics. The owner reads "how much can I
// trust this number", not a confidence-interval label.
const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Reliable estimate',
  medium: 'Fairly reliable',
  low: 'Rough estimate',
};

// What the estimate is BASED ON, said the way an owner would — never the model's
// textbook name (Holt-Winters, exponential smoothing, …).
const MODEL_LABEL: Record<string, string> = {
  holt_winters_seasonal: 'based on seasonal patterns',
  holt_linear_trend: 'based on the recent trend',
  simple_exp_smoothing: 'based on recent sales',
  naive: 'based on the average of recent weeks',
  none: '—',
};

const ACTUAL = '#CC0000';
const FORECAST = '#B8912E';

const fmtWeek = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/**
 * Demand forecast for one product, in the language of a proper planning chart:
 * solid actuals with a soft fill, a clear vertical divider where the forecast
 * begins, the prediction as a dashed line inside a tinted "forecast zone", and a
 * confidence band that widens the less sure the model is. The band IS the
 * honesty — a wide band reads as "estimate", which is exactly right.
 */
export function ForecastChart({ forecast }: { forecast: ProductForecast }) {
  const { history, forecast: fc } = forecast;

  const data: Array<{
    label: string;
    actual?: number;
    predicted?: number;
    band?: [number, number];
  }> = history.map((h) => ({ label: fmtWeek(h.week), actual: h.qty }));

  // Seed the dashed line + band from the last real point so they connect.
  const lastQty = history.length ? history[history.length - 1].qty : 0;
  const boundaryLabel = data.length ? data[data.length - 1].label : '';
  if (data.length) {
    data[data.length - 1].predicted = lastQty;
    data[data.length - 1].band = [lastQty, lastQty];
  }
  fc.predicted.forEach((p, i) => {
    data.push({
      label: `+${i + 1}w`,
      predicted: p,
      band: [fc.lower[i], fc.upper[i]],
    });
  });
  const lastLabel = data.length ? data[data.length - 1].label : '';

  const totalNext = fc.predicted.reduce((s, v) => s + v, 0);
  const recentAvg = avg(history.slice(-4).map((h) => h.qty));
  const predAvg = avg(fc.predicted);
  const dir =
    predAvg > recentAvg * 1.08 ? 'up' : predAvg < recentAvg * 0.92 ? 'down' : 'flat';
  const DirIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const dirColor =
    dir === 'up' ? '#2F6B49' : dir === 'down' ? '#A80000' : '#928E82';
  const dirText =
    dir === 'up' ? 'trending up' : dir === 'down' ? 'trending down' : 'holding steady';

  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      {/* Header — big number, quiet context (reference cue). */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-[#0F0F0F]">
            {forecast.product}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#928E82]">
            <DirIcon size={12} style={{ color: dirColor }} />
            <span style={{ color: dirColor }}>{dirText}</span>
            <span className="text-[#D5D2C8]">·</span>
            {MODEL_LABEL[fc.model] ?? fc.model}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[26px] font-bold leading-none tabular-nums tracking-[-0.02em] text-[#0F0F0F]">
            {totalNext}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-[#928E82]">
            likely to sell · next {fc.predicted.length} weeks
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6E6A5E]">
        <Legend swatch={<span className="h-[2px] w-4 rounded-full" style={{ background: ACTUAL }} />}>
          Actual
        </Legend>
        <Legend
          swatch={<span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: FORECAST }} />}
        >
          Expected
        </Legend>
        <Legend
          swatch={<span className="h-2.5 w-4 rounded-sm" style={{ background: FORECAST, opacity: 0.18 }} />}
        >
          Likely range
        </Legend>
        <span className="ml-auto">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CONFIDENCE_STYLE[fc.confidence]}`}
          >
            {CONFIDENCE_LABEL[fc.confidence] ?? fc.confidence}
          </span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={244}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="fcActualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACTUAL} stopOpacity={0.14} />
              <stop offset="92%" stopColor={ACTUAL} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fcBandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FORECAST} stopOpacity={0.24} />
              <stop offset="100%" stopColor={FORECAST} stopOpacity={0.06} />
            </linearGradient>
          </defs>

          {/* Forecast zone — a soft tint over the future so past vs prediction
              reads at a glance. */}
          {boundaryLabel && lastLabel && (
            <ReferenceArea
              x1={boundaryLabel}
              x2={lastLabel}
              fill={FORECAST}
              fillOpacity={0.05}
              strokeOpacity={0}
            />
          )}

          <CartesianGrid strokeDasharray="2 5" stroke="#F2F1ED" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#B8B4A8' }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.floor(data.length / 7))}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#B8B4A8' }}
            tickLine={false}
            axisLine={false}
            width={34}
            allowDecimals={false}
          />

          {/* "Forecast begins here" divider. */}
          {boundaryLabel && (
            <ReferenceLine
              x={boundaryLabel}
              stroke="#D5D2C8"
              strokeDasharray="3 3"
              label={{
                value: 'Expected',
                position: 'insideTopRight',
                fill: FORECAST,
                fontSize: 10,
                fontWeight: 600,
                dy: -2,
              }}
            />
          )}

          {/* Prominent full-height crosshair on hover (reference cue). */}
          <Tooltip
            cursor={{ stroke: '#B8B4A8', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              const isForecast = row.actual === undefined;
              const val = row.actual ?? row.predicted ?? 0;
              return (
                <div className="rounded-lg bg-[#0F0F0F] px-3 py-2 shadow-xl">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    {isForecast ? 'Expected · ' : ''}
                    {label}
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold tabular-nums text-white">
                    {val} units
                  </p>
                  {isForecast && row.band && (
                    <p className="text-[11px] text-white/50">
                      likely {row.band[0]}–{row.band[1]}
                    </p>
                  )}
                </div>
              );
            }}
          />

          {/* Confidence band (spans only the forecast section). */}
          <Area
            dataKey="band"
            stroke="none"
            fill="url(#fcBandFill)"
            connectNulls
            isAnimationActive={false}
          />
          {/* Soft fill under actuals — a sense of volume. */}
          <Area
            dataKey="actual"
            type="monotone"
            stroke="none"
            fill="url(#fcActualFill)"
            connectNulls={false}
            isAnimationActive={false}
          />
          {/* Actual line. */}
          <Line
            dataKey="actual"
            type="monotone"
            stroke={ACTUAL}
            strokeWidth={2.25}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: ACTUAL, stroke: '#fff', strokeWidth: 2 }}
          />
          {/* Forecast line. */}
          <Line
            dataKey="predicted"
            type="monotone"
            stroke={FORECAST}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
            activeDot={{ r: 4, fill: FORECAST, stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {fc.note && (
        <p className="mt-3 rounded-lg bg-[#FAF9F6] px-3 py-2 text-[11px] leading-relaxed text-[#6E6A5E]">
          {fc.note}
        </p>
      )}
    </div>
  );
}

function Legend({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center">{swatch}</span>
      {children}
    </span>
  );
}
