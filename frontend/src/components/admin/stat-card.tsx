'use client';

import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /**
   * Percent change vs the previous period of equal length. `null` means there was
   * no prior data — shown as "no prior data", never as "+100%", because going
   * from zero to something is a first sale, not growth.
   */
  changePercent?: number | null;
  changeLabel?: string;
  hint?: string;
  /** Crimson treatment — reserved for figures that demand an action. */
  alert?: boolean;
  /**
   * The obsidian treatment. Exactly ONE card on a screen should have it — the
   * number the owner opened the page for. A dark card among light ones creates
   * hierarchy instantly and without a single extra word; make two of them dark
   * and you have made neither of them important.
   */
  hero?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  changePercent,
  changeLabel = 'vs previous period',
  hint,
  alert,
  hero,
  loading,
}: StatCardProps) {
  const hasChange = changePercent !== undefined;
  const up = (changePercent ?? 0) > 0;
  const flat = changePercent === 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl p-5 transition-all duration-200',
        hero
          ? // Obsidian, with a crimson bloom bleeding in from the corner. Depth
            // comes from the gradient, not from a heavy shadow.
            'bg-[#0F0F0F] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(204,0,0,0.28)]'
          : // Warm white on a warm canvas. A cool grey card over a warm brand is a
            // discord you feel before you can name it.
            'border border-[#EAE8E1] bg-white shadow-[0_1px_2px_rgba(74,71,64,0.04)] hover:border-[#D5D2C8] hover:shadow-[0_2px_8px_rgba(74,71,64,0.06)]',
        alert && !hero && 'border-[#CC0000]/25',
      )}
    >
      {hero && (
        <>
          {/* The bloom. Radial, off-centre, barely there — a light source rather
              than a decoration. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#CC0000] opacity-[0.22] blur-3xl"
          />
          {/* A one-pixel gold hairline. The luxury signal crimson cannot carry on
              its own — and gold used ANYWHERE else would cheapen it. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent"
          />
        </>
      )}

      {alert && !hero && (
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-[#CC0000]" />
      )}

      <div className="relative flex items-start justify-between">
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.16em]',
            hero ? 'text-white/45' : 'text-[#928E82]',
          )}
        >
          {label}
        </p>
        <Icon
          size={15}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            'shrink-0',
            hero
              ? 'text-[#D4AF37]/70'
              : alert
                ? 'text-[#CC0000]'
                : 'text-[#D5D2C8]',
          )}
        />
      </div>

      {loading ? (
        <div
          className={cn(
            'mt-3 h-8 w-28 animate-pulse rounded',
            hero ? 'bg-white/10' : 'bg-[#F4F3EF]',
          )}
        />
      ) : (
        <p
          className={cn(
            'relative mt-2.5 font-display text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums',
            hero ? 'text-white' : 'text-[#0F0F0F]',
          )}
        >
          {value}
        </p>
      )}

      <div className="relative mt-3 flex items-center gap-1.5">
        {hasChange && changePercent !== null && !loading && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
              hero
                ? flat
                  ? 'bg-white/10 text-white/60'
                  : up
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-[#CC0000]/25 text-[#FF7070]'
                : flat
                  ? 'bg-[#F4F3EF] text-[#6E6A5E]'
                  : up
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-[#FFF0F0] text-[#A80000]',
            )}
          >
            {!flat &&
              (up ? (
                <TrendingUp size={11} strokeWidth={2.5} aria-hidden />
              ) : (
                <TrendingDown size={11} strokeWidth={2.5} aria-hidden />
              ))}
            {up ? '+' : ''}
            {changePercent}%
          </span>
        )}

        <span
          className={cn(
            'truncate text-[11px]',
            hero
              ? 'text-white/40'
              : alert
                ? 'font-medium text-[#CC0000]'
                : 'text-[#928E82]',
          )}
        >
          {hint ??
            (hasChange
              ? changePercent === null
                ? 'No prior period to compare'
                : changeLabel
              : '')}
        </span>
      </div>
    </div>
  );
}
