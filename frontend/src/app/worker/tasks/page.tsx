'use client';

import { ClipboardList } from 'lucide-react';

import { MeasurementsTable } from '@/components/production/measurements-table';
import { TaskActions } from '@/components/production/task-actions';
import { Button } from '@/components/ui/button';
import { useMyTasks } from '@/hooks/use-production';
import { STAGE_LABEL } from '@/types/production';

/**
 * The worker's queue (plan Session 6.2, doc 10 §2 and §10).
 *
 * Designed for a phone held by someone standing at a cutting table with
 * fabric-dusty thumbs: one column, oldest job first, 48px buttons, and the
 * measurements printed right there on the card — because the alternative is
 * walking back to a desk to look them up.
 *
 * Deliberately NOT a board. A worker has one question ("what do I do next?") and
 * this page answers it from the top down.
 */
export default function WorkerTasksPage() {
  const { data: tasks, isLoading, isError, refetch } = useMyTasks();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-neutral-200"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-3 text-sm text-red-700">Could not load your tasks.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
        <ClipboardList className="mb-4 h-10 w-10 text-neutral-400" aria-hidden />
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">
          No tasks assigned to you
        </h1>
        <p className="max-w-sm text-sm text-neutral-500">
          Cutting, stitching and finishing jobs appear here as soon as an admin
          assigns them to you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        {tasks.length} job{tasks.length === 1 ? '' : 's'} — oldest first
      </p>

      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-xl border border-neutral-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold leading-tight text-neutral-900">
                {task.product}
                {task.quantity > 1 && (
                  <span className="ml-1.5 text-neutral-500">
                    ×{task.quantity}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-neutral-500">
                {task.orderNumber}
              </p>
            </div>

            {/* Which of the four stages this job is at, and whether it's running. */}
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {STAGE_LABEL[task.stage]}
              </span>
              <p className="mt-1 text-[11px] text-neutral-400">
                {task.status === 'IN_PROGRESS' ? 'in progress' : 'not started'}
              </p>
            </div>
          </div>

          {/* A rework note is the first thing they must read. */}
          {task.note && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Sent back: {task.note}
            </p>
          )}

          <div className="mt-3">
            <MeasurementsTable measurements={task.measurements} />
          </div>

          <div className="mt-4">
            {/* 48px targets — the whole point of the `touch` size. */}
            <TaskActions task={task} size="touch" />
          </div>
        </article>
      ))}
    </div>
  );
}
