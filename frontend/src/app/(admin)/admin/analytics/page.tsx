'use client';

import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  PackageX,
  ShoppingCart,
  Snowflake,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';

import { ForecastChart } from '@/components/admin/forecast-chart';
import {
  useDeadStock,
  useForecast,
  useRecommendations,
  useReorder,
  useTopProducts,
  useTrending,
} from '@/hooks/use-analytics';
import { formatLKR } from '@/lib/format';
import { TrendingItem } from '@/types';

/* ── shared bits ─────────────────────────────────────────── */

function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={15} className="text-[#928E82]" />
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[#0F0F0F]">
            {title}
          </h2>
          {subtitle && <p className="text-[11px] text-[#928E82]">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}

const Waking = () => (
  <p className="py-6 text-center text-[12px] text-[#928E82]">
    The analytics service is waking up — try again in a moment.
  </p>
);

const MoverRow = ({ item }: { item: TrendingItem }) => (
  <li className="flex items-center justify-between gap-3">
    <span className="truncate text-[13px] text-[#0F0F0F]">{item.name}</span>
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-[12px] tabular-nums text-[#928E82]">
        {item.current} sold
      </span>
      {item.is_new ? (
        <span className="rounded bg-[#EFF4FA] px-1.5 py-0.5 text-[10px] font-semibold text-[#3A5F87]">
          NEW
        </span>
      ) : item.growth_percent !== null ? (
        <span
          className={`flex items-center gap-0.5 text-[12px] font-semibold tabular-nums ${
            item.growth_percent >= 0 ? 'text-[#2F6B49]' : 'text-[#A80000]'
          }`}
        >
          {item.growth_percent >= 0 ? (
            <ArrowUpRight size={13} />
          ) : (
            <ArrowDownRight size={13} />
          )}
          {Math.abs(item.growth_percent)}%
        </span>
      ) : null}
    </span>
  </li>
);

/* ── page ────────────────────────────────────────────────── */

const COVER_STYLE = (weeks: number) =>
  weeks < 1.5
    ? 'bg-[#FFF0F0] text-[#A80000]'
    : weeks < 3
      ? 'bg-[#FBF3E4] text-[#8F711D]'
      : 'bg-[#EDF7F1] text-[#2F6B49]';

const STAR_PERIODS: { key: string; label: string }[] = [
  { key: '30d', label: 'Month' },
  { key: '90d', label: 'Quarter' },
  { key: '365d', label: 'Year' },
];

export default function AdminAnalyticsPage() {
  const reorder = useReorder();
  const forecast = useForecast();
  const trending = useTrending();
  const deadStock = useDeadStock();
  const recs = useRecommendations();

  const [starPeriod, setStarPeriod] = useState('90d');
  const stars = useTopProducts(starPeriod);

  const [selected, setSelected] = useState(0);
  const products = forecast.data?.products ?? [];

  // Headline figures.
  const reorderCount = reorder.data?.items?.length ?? 0;
  const topStar = stars.data?.products?.[0];
  const topRiser = trending.data?.risers?.[0];
  const deadCount = deadStock.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-[#0F0F0F]">
          Analytics
        </h1>
        <p className="mt-1 text-[13px] text-[#928E82]">
          What to reorder, what&apos;s hot, what&apos;s cooling — decisions at a
          glance.
        </p>
      </div>

      {/* ── KPI headline strip ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Reorder soon"
          icon={ShoppingCart}
          value={reorderCount}
          hint={reorderCount ? 'will run low' : 'stock healthy'}
          tone={reorderCount ? 'alert' : 'good'}
          loading={reorder.isLoading}
        />
        <Kpi
          label="Star product"
          icon={Star}
          value={topStar?.name ?? '—'}
          hint={topStar ? `${topStar.quantity} sold` : 'no data'}
          small
          loading={stars.isLoading}
        />
        <Kpi
          label="Fastest growing"
          icon={TrendingUp}
          value={topRiser?.name ?? '—'}
          hint={
            topRiser
              ? topRiser.is_new
                ? 'new product'
                : `+${topRiser.growth_percent}%`
              : 'no data'
          }
          small
          tone="good"
          loading={trending.isLoading}
        />
        <Kpi
          label="Dead stock"
          icon={PackageX}
          value={deadCount}
          hint={deadCount ? 'not selling' : 'all moving'}
          tone={deadCount ? 'alert' : 'good'}
          loading={deadStock.isLoading}
        />
      </div>

      {/* ── Reorder — the hero decision ── */}
      <Panel
        title="Reorder before you run out"
        subtitle="How much you're likely to sell in the next 4 weeks vs. what's in stock now"
        icon={ShoppingCart}
      >
        {reorder.isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-[#FAF9F6]" />
        ) : reorder.data?.unavailable ? (
          <Waking />
        ) : !reorder.data?.items.length ? (
          <p className="py-6 text-center text-[12px] text-[#2F6B49]">
            Stock levels look healthy — nothing is expected to run out in the next
            4 weeks.
          </p>
        ) : (
          <>
            {/* 📱 MOBILE VIEW: Reorder Cards (< md) */}
            <div className="divide-y divide-[#F4F3EF] md:hidden">
              {reorder.data.items.map((r) => (
                <div key={r.product} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#0F0F0F]">{r.product}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${COVER_STYLE(r.weeks_of_cover)}`}
                    >
                      {r.weeks_of_cover}w cover
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded bg-[#FAFAF8] p-1.5">
                      <span className="text-[10px] text-[#928E82]">Est. Sales</span>
                      <p className="font-semibold text-[#0F0F0F]">{r.predicted}</p>
                    </div>
                    <div className="rounded bg-[#FAFAF8] p-1.5">
                      <span className="text-[10px] text-[#928E82]">In Stock</span>
                      <p className="font-semibold text-[#6E6A5E]">{r.in_stock}</p>
                    </div>
                    <div className="rounded bg-[#FAFAF8] p-1.5">
                      <span className="text-[10px] text-[#928E82]">Reorder</span>
                      <p className="font-bold text-[#CC0000]">+{r.suggested_reorder}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 💻 DESKTOP VIEW: Table (≥ md) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[580px] text-[13px]">
                <thead>
                  <tr className="border-b border-[#EAE8E1] text-left text-[11px] uppercase tracking-wide text-[#928E82]">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 text-right font-medium">Likely to sell (4 wks)</th>
                    <th className="pb-2 text-right font-medium">In stock</th>
                    <th className="pb-2 text-right font-medium">Reorder</th>
                    <th className="pb-2 text-right font-medium">Cover</th>
                  </tr>
                </thead>
                <tbody>
                  {reorder.data.items.map((r) => (
                    <tr key={r.product} className="border-b border-[#F4F3EF] last:border-0">
                      <td className="py-2.5 text-[#0F0F0F]">{r.product}</td>
                      <td className="py-2.5 text-right tabular-nums text-[#0F0F0F]">
                        {r.predicted}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-[#928E82]">
                        {r.in_stock}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="font-semibold tabular-nums text-[#0F0F0F]">
                          +{r.suggested_reorder}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${COVER_STYLE(r.weeks_of_cover)}`}
                        >
                          {r.weeks_of_cover}w
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-[#928E82]">
                &quot;Cover&quot; is how many weeks the current stock lasts at the
                expected selling rate. Lower = more urgent.
              </p>
            </div>
          </>
        )}
      </Panel>

      {/* ── Momentum: up vs down ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Trending up" subtitle="vs the previous 30 days" icon={TrendingUp}>
          {trending.isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-[#FAF9F6]" />
          ) : trending.data?.unavailable ? (
            <Waking />
          ) : !trending.data?.risers.length ? (
            <p className="py-6 text-center text-[12px] text-[#928E82]">
              No products are clearly growing this period.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {trending.data.risers.map((t) => (
                <MoverRow key={t.name} item={t} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Cooling down" subtitle="losing momentum" icon={Snowflake}>
          {trending.isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-[#FAF9F6]" />
          ) : trending.data?.unavailable ? (
            <Waking />
          ) : !trending.data?.decliners.length ? (
            <p className="py-6 text-center text-[12px] text-[#2F6B49]">
              Nothing's slipping — demand is steady or rising across the board.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {trending.data.decliners.map((t) => (
                <MoverRow key={t.name} item={t} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Star products ── */}
      <Panel
        title="Best sellers"
        subtitle="your star products by revenue"
        icon={Star}
        action={
          <div className="flex gap-1">
            {STAR_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setStarPeriod(p.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  starPeriod === p.key
                    ? 'bg-[#0F0F0F] text-white'
                    : 'bg-[#F4F3EF] text-[#6E6A5E] hover:bg-[#EAE8E1]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      >
        {stars.isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-[#FAF9F6]" />
        ) : stars.data?.unavailable ? (
          <Waking />
        ) : !stars.data?.products.length ? (
          <p className="py-6 text-center text-[12px] text-[#928E82]">
            No sales in this window yet.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {stars.data.products.map((s, i) => (
              <li key={s.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F4F3EF] text-[10px] font-bold text-[#6E6A5E]">
                    {i + 1}
                  </span>
                  <span className="truncate text-[13px] text-[#0F0F0F]">{s.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[12px] tabular-nums text-[#928E82]">
                    {s.quantity} sold
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-[#0F0F0F]">
                    {formatLKR(s.revenue)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {/* ── Sales outlook (drill-down) ── */}
      <section>
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0F0F0F]">
              Sales outlook
            </h2>
            <p className="text-[11px] text-[#928E82]">
              How much you&apos;re likely to sell in the coming weeks
            </p>
          </div>
          {products.length > 1 && (
            <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {products.map((p, i) => (
                <button
                  key={p.product}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    i === selected
                      ? 'bg-[#0F0F0F] text-white'
                      : 'bg-[#F4F3EF] text-[#6E6A5E] hover:bg-[#EAE8E1]'
                  }`}
                >
                  {p.product}
                </button>
              ))}
            </div>
          )}
        </div>
        {forecast.isLoading ? (
          <div className="h-56 animate-pulse rounded-2xl border border-[#EAE8E1] bg-[#FAF9F6]" />
        ) : forecast.data?.unavailable ? (
          <div className="rounded-2xl border border-[#EAE8E1] bg-white p-6">
            <Waking />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-[#EAE8E1] bg-white p-8 text-center">
            <p className="text-sm font-medium text-[#0F0F0F]">
              Not enough sales history yet
            </p>
            <p className="mt-1 text-xs text-[#928E82]">
              The outlook appears once a product has a few weeks of sales.
            </p>
          </div>
        ) : (
          <ForecastChart forecast={products[Math.min(selected, products.length - 1)]} />
        )}
      </section>

      {/* ── Frequently bought together ── */}
      <Panel
        title="Frequently bought together"
        subtitle="products customers often buy as a pair — sell them as a bundle"
        icon={Sparkles}
      >
        {recs.isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-[#FAF9F6]" />
        ) : recs.data?.unavailable ? (
          <Waking />
        ) : !recs.data?.pairs.length ? (
          <p className="py-6 text-center text-[12px] text-[#928E82]">
            Not enough multi-item orders yet to spot pairings.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {recs.data.pairs.map((p) => (
              <li
                key={`${p.product_a}-${p.product_b}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-[13px] text-[#0F0F0F]">
                  {p.product_a} <span className="text-[#B8B4A8]">+</span>{' '}
                  {p.product_b}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-[#928E82]">
                  {p.together_count}× together
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ── KPI tile ────────────────────────────────────────────── */

function Kpi({
  label,
  icon: Icon,
  value,
  hint,
  tone = 'neutral',
  small = false,
  loading = false,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string | number;
  hint: string;
  tone?: 'neutral' | 'good' | 'alert';
  small?: boolean;
  loading?: boolean;
}) {
  const hintColor =
    tone === 'alert'
      ? 'text-[#A80000]'
      : tone === 'good'
        ? 'text-[#2F6B49]'
        : 'text-[#928E82]';

  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-5 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={13} className="text-[#B8B4A8]" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#928E82]">
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-2/3 animate-pulse rounded bg-[#F4F3EF]" />
      ) : (
        <p
          className={`truncate font-display font-bold tracking-[-0.02em] text-[#0F0F0F] ${
            small ? 'text-[15px]' : 'text-[26px]'
          }`}
          title={String(value)}
        >
          {value}
        </p>
      )}
      <p className={`mt-0.5 text-[11px] ${hintColor}`}>{hint}</p>
    </div>
  );
}
