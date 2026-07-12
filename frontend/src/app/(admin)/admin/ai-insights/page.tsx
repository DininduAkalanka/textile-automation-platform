'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Send, Sparkles, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { businessAiService, BusinessReply } from '@/services/business-ai.service';
import { useAuthStore } from '@/store/useAuthStore';

interface Turn {
  question: string;
  reply?: BusinessReply;
  error?: string;
}

const SUGGESTIONS = [
  'How is business this month?',
  'What should I restock?',
  'Which products are most profitable?',
  'Revenue trend over 90 days',
];

/** Tool names → what the owner would call them. */
const TOOL_LABEL: Record<string, string> = {
  get_sales_summary: 'Sales summary',
  get_top_products: 'Top products',
  get_revenue_trend: 'Revenue trend',
  get_low_stock: 'Low stock',
  get_profit_by_product: 'Profit by product',
  get_order_status_breakdown: 'Order statuses',
};

/**
 * The owner's analyst (plan Session 9.2 / 9.3).
 *
 * Two things this page does that a normal chat does not, and both are deliberate:
 *
 *  - it shows WHICH TOOLS RAN. The answer is not a black box; the owner can see
 *    the restock advice came from the low-stock query, not from thin air.
 *  - it shows the RAW DATA behind the answer. Every figure is auditable. An
 *    assistant that reports revenue has to be checkable, or it should not be
 *    trusted with the question.
 */
export default function AiInsightsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  const ask = useMutation({
    mutationFn: (question: string) => businessAiService.ask(question),
    onMutate: (question) => {
      setTurns((t) => [...t, { question }]);
    },
    onSuccess: (reply) => {
      setTurns((t) =>
        t.map((turn, i) => (i === t.length - 1 ? { ...turn, reply } : turn)),
      );
    },
    onError: (error: Error) => {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1 ? { ...turn, error: error.message } : turn,
        ),
      );
    },
  });

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="container py-20 text-center">
        <h2 className="mb-2 text-xl font-semibold">Admin access required</h2>
        <Link href="/login" className="text-indigo-600">
          Sign in
        </Link>
      </div>
    );
  }

  const submit = (question: string) => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setDraft('');
    ask.mutate(q);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight text-neutral-900">
          <Sparkles className="h-5 w-5 text-[#CC0000]" strokeWidth={1.75} aria-hidden />
          Business insights
        </h1>
        <p className="mt-0.5 text-sm text-neutral-400">
          Ask about your sales, stock and margins in plain English.
        </p>
      </div>

      {turns.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-indigo-300" aria-hidden />
          <p className="text-sm font-medium text-neutral-900">
            What would you like to know?
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-500">
            Every answer is computed from your own records — and I&apos;ll show you
            exactly which figures I used.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submit(suggestion)}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:border-indigo-400 hover:text-indigo-600"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {turns.map((turn, index) => (
          <div key={index} className="space-y-3">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl bg-indigo-600 px-4 py-2 text-sm text-white">
              {turn.question}
            </p>

            {turn.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {turn.error}
              </div>
            )}

            {turn.reply && <Answer reply={turn.reply} />}

            {!turn.reply && !turn.error && ask.isPending && (
              <div className="flex w-16 gap-1 rounded-2xl bg-neutral-100 px-3.5 py-3">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="sticky bottom-4 mt-6 flex gap-2 rounded-full border border-neutral-200 bg-white p-2 shadow-lg"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 500))}
          placeholder="e.g. what should I restock this week?"
          aria-label="Ask about your business"
          className="flex-1 rounded-full px-4 py-2 text-sm focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0 rounded-full"
          disabled={!draft.trim() || ask.isPending}
          aria-label="Ask"
        >
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}

function Answer({ reply }: { reply: BusinessReply }) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      {/* The grounding check caught a number that is in no tool's output. Say so
          loudly: an unverified business figure is worse than no figure, because
          the owner would act on it. */}
      {!reply.grounded && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong>Unverified.</strong> Some figures in this answer could not be
            matched to your records, so the summary is withheld. The raw data below
            is accurate.
          </span>
        </div>
      )}

      <p className="text-sm leading-relaxed text-neutral-900">{reply.insight}</p>

      {reply.recommendation && (
        <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Recommended
          </p>
          <p className="mt-0.5 text-sm text-indigo-900">{reply.recommendation}</p>
        </div>
      )}

      {reply.chartSpec && <Chart spec={reply.chartSpec} />}

      {/* Auditability: which whitelisted tools ran, and what they returned. */}
      {reply.toolsUsed.length > 0 && (
        <details className="rounded-lg bg-neutral-50 p-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-600">
            <Wrench size={12} aria-hidden />
            Computed from: {reply.toolsUsed.map((t) => TOOL_LABEL[t] ?? t).join(', ')}
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-neutral-600">
            {JSON.stringify(reply.data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * A deliberately simple chart.
 *
 * Recharts is the plan's choice for the dashboard, but a bar rendered in CSS
 * cannot crash, has no bundle cost, and reads perfectly at this size. When the
 * dashboard's Recharts components land (Session 8.1 UI), this maps onto them.
 */
function Chart({ spec }: { spec: { title: string; categories: string[]; series: number[] } }) {
  const max = Math.max(...spec.series, 1);

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="mb-2 text-xs font-semibold text-neutral-700">{spec.title}</p>
      <div className="space-y-1.5">
        {spec.categories.map((category, i) => (
          <div key={category} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[11px] text-neutral-500">
              {category}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100">
              <div
                className="h-full rounded bg-indigo-500"
                style={{
                  width: `${Math.max(2, ((spec.series[i] ?? 0) / max) * 100)}%`,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-neutral-700">
              {(spec.series[i] ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
