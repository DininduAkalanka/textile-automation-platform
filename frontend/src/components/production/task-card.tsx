'use client';

import { AlertTriangle, Ruler, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ProductionTask, TaskStatus } from '@/types/production';

/**
 * Age thresholds (plan Session 6.2). A task sitting on the floor for three days
 * is the single most useful thing an admin can see, so it is a colour, not a
 * number to be worked out.
 */
const AMBER_HOURS = 24;
const RED_HOURS = 72;

const STATUS_STYLE: Record<TaskStatus, string> = {
  PENDING: 'bg-neutral-100 text-neutral-600',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Not started',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export function TaskCard({
  task,
  onClick,
}: {
  task: ProductionTask;
  onClick?: () => void;
}) {
  const overdue = task.ageHours >= RED_HOURS;
  const ageing = !overdue && task.ageHours >= AMBER_HOURS;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border bg-white p-3 text-left transition-shadow hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        overdue
          ? 'border-red-300'
          : ageing
            ? 'border-amber-300'
            : 'border-neutral-200',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-neutral-500">
          {task.orderNumber}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            STATUS_STYLE[task.status],
          )}
        >
          {STATUS_LABEL[task.status]}
        </span>
      </div>

      <p className="mt-1.5 font-medium leading-snug text-neutral-900">
        {task.product}
        {task.quantity > 1 && (
          <span className="ml-1 text-neutral-500">×{task.quantity}</span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        {/* BR5: unassigned is the state that BLOCKS work, so it shouts. */}
        {task.worker ? (
          <span className="inline-flex items-center gap-1">
            <User size={12} aria-hidden />
            {task.worker.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <AlertTriangle size={12} aria-hidden />
            Unassigned
          </span>
        )}

        {task.measurements && (
          <span className="inline-flex items-center gap-1">
            <Ruler size={12} aria-hidden />
            {task.measurements.personName}
          </span>
        )}

        <span
          className={cn(
            'ml-auto tabular-nums',
            overdue
              ? 'font-semibold text-red-600'
              : ageing
                ? 'font-medium text-amber-600'
                : 'text-neutral-400',
          )}
        >
          {task.ageHours < 1 ? 'new' : `${task.ageHours}h`}
        </span>
      </div>

      {/* A QC rejection note is the most important thing on the card. */}
      {task.note && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs leading-snug text-red-700">
          {task.note}
        </p>
      )}
    </button>
  );
}
