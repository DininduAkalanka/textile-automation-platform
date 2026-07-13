'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Factory } from 'lucide-react';

import { TaskCard } from '@/components/production/task-card';
import { TaskDrawer } from '@/components/production/task-drawer';
import { Button } from '@/components/ui/button';
import { usePipeline, useWorkers } from '@/hooks/use-production';
import { useAuthStore } from '@/store/useAuthStore';
import { ProductionTask, STAGE_LABEL, STAGE_ORDER } from '@/types/production';

/**
 * The admin production board (plan Session 6.2).
 *
 * Four columns, one per stage. Buttons rather than drag-and-drop: a stage move
 * is a state transition the API validates, not a position, and DnD would imply
 * the board can put a garment anywhere. Drag-and-drop is noted as a stretch.
 */
export default function ProductionBoardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { data: pipeline, isLoading, isError, refetch } = usePipeline();
  const { data: workers } = useWorkers();
  const [selected, setSelected] = useState<ProductionTask | null>(null);
  const [workerFilter, setWorkerFilter] = useState('');

  // The API is the real gate (401/403); this is only so the page does not flash
  // a broken board at someone who should not be here.
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

  const totalTasks = pipeline
    ? STAGE_ORDER.reduce((sum, stage) => sum + pipeline[stage].length, 0)
    : 0;

  return (
    <div>
      {/* No "back to dashboard" link and no container: the admin shell provides
          both the sidebar navigation and the page padding. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Production
          </h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            {isLoading
              ? 'Loading the floor…'
              : `${totalTasks} task${totalTasks === 1 ? '' : 's'} on the floor`}
          </p>
        </div>

        {workers && workers.length > 0 && (
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            aria-label="Filter by worker"
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="">Everyone</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-3 text-sm text-red-700">
            Could not load the production board.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="rounded-xl bg-neutral-100 p-3">
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-neutral-200" />
              <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
            </div>
          ))}
        </div>
      )}

      {pipeline && totalTasks === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
          <Factory className="mb-4 h-10 w-10 text-neutral-400" aria-hidden />
          <h2 className="mb-1 text-lg font-semibold">Nothing in production</h2>
          <p className="max-w-sm text-sm text-neutral-500">
            Tasks appear here automatically when an order containing a uniform or
            custom garment is paid for.
          </p>
        </div>
      )}

      {pipeline && totalTasks > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGE_ORDER.map((stage) => {
            const tasks = workerFilter
              ? pipeline[stage].filter((t) => t.worker?.id === workerFilter)
              : pipeline[stage];

            return (
              <section
                key={stage}
                aria-label={STAGE_LABEL[stage]}
                className="rounded-xl bg-neutral-100 p-3"
              >
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-neutral-700">
                    {STAGE_LABEL[stage]}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {tasks.length}
                  </span>
                </header>

                <div className="flex flex-col gap-2">
                  {tasks.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-neutral-400">
                      Empty
                    </p>
                  ) : (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => setSelected(task)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskDrawer
        // Re-read from the freshly fetched pipeline so the drawer's buttons
        // reflect the CURRENT state after a mutation, not the card we clicked.
        task={
          selected && pipeline
            ? (STAGE_ORDER.flatMap((s) => pipeline[s]).find(
                (t) => t.id === selected.id,
              ) ?? null)
            : null
        }
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
