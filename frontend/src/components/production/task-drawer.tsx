'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAssignTask, useWorkers } from '@/hooks/use-production';
import { MeasurementsTable } from './measurements-table';
import { TaskActions } from './task-actions';
import { ProductionTask, STAGE_LABEL } from '@/types/production';

interface TaskDrawerProps {
  task: ProductionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Everything an admin needs to act on one task, in one place. */
export function TaskDrawer({ task, open, onOpenChange }: TaskDrawerProps) {
  const { data: workers } = useWorkers();
  const assign = useAssignTask();

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div>
          <DialogTitle>{task.product}</DialogTitle>
          <DialogDescription className="mt-1 font-mono">
            {task.orderNumber} · {STAGE_LABEL[task.stage]} · ×{task.quantity}
          </DialogDescription>
        </div>

        {/* BR5 — a task cannot be started until this select has a value, which is
            why assignment sits above the action buttons rather than beside them. */}
        <div className="space-y-1.5">
          <Label htmlFor="assignee">Assigned worker</Label>
          <select
            id="assignee"
            value={task.worker?.id ?? ''}
            disabled={assign.isPending || task.status === 'IN_PROGRESS'}
            onChange={(event) =>
              assign.mutate({ taskId: task.id, workerId: event.target.value })
            }
            className="flex h-10 w-full rounded-[10px] border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              Choose a worker…
            </option>
            {workers?.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
                {worker.specialization
                  ? ` — ${STAGE_LABEL[worker.specialization]}`
                  : ''}
              </option>
            ))}
          </select>

          {task.status === 'IN_PROGRESS' && (
            <p className="text-xs text-neutral-500">
              Work has started — finish or fail it before reassigning.
            </p>
          )}
          {!task.worker && (
            <p className="text-xs font-medium text-amber-700">
              Assign someone before this task can be started.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Measurements</Label>
          <MeasurementsTable measurements={task.measurements} />
        </div>

        {task.note && (
          <div className="space-y-1.5">
            <Label>Quality control note</Label>
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {task.note}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Actions</Label>
          <TaskActions task={task} />
        </div>

        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
