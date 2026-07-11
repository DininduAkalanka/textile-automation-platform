'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTaskAction } from '@/hooks/use-production';
import { cn } from '@/lib/utils';
import { ACTION_LABEL, ProductionTask, TaskAction } from '@/types/production';

interface TaskActionsProps {
  task: ProductionTask;
  /** `touch` gives 48px targets for the worker portal (doc 10 §10). */
  size?: 'default' | 'touch';
}

/**
 * The buttons that move a task.
 *
 * Rendered from `task.allowedActions`, which the SERVER computes from the same
 * state machine it enforces. There is no second copy of the rules here, so the
 * board can never offer a move the API would then refuse — and when the machine
 * changes, the buttons change with it.
 */
export function TaskActions({ task, size = 'default' }: TaskActionsProps) {
  const act = useTaskAction();
  const [failing, setFailing] = useState(false);
  const [note, setNote] = useState('');

  const run = (action: TaskAction) => {
    // A QC rejection needs a reason — the worker has to know what to fix.
    if (action === 'qc_fail') {
      setFailing(true);
      return;
    }
    act.mutate({ taskId: task.id, action });
  };

  const variantFor = (action: TaskAction) => {
    if (action === 'qc_fail') return 'destructive' as const;
    if (action === 'qc_pass') return 'default' as const;
    return 'outline' as const;
  };

  if (task.allowedActions.length === 0) {
    // Two very different reasons produce an empty list, and telling them apart
    // matters: one is a dead end, the other is a thing someone must go and do.
    const blockedByBr5 = !task.worker && task.status === 'PENDING';

    return (
      <p
        className={cn(
          'text-sm',
          blockedByBr5 ? 'font-medium text-amber-700' : 'text-neutral-500',
        )}
      >
        {blockedByBr5
          ? 'Assign a worker before this task can be started.'
          : 'This task is finished — nothing left to do.'}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {task.allowedActions.map((action) => (
          <Button
            key={action}
            size={size}
            variant={variantFor(action)}
            loading={act.isPending}
            onClick={() => run(action)}
            className={size === 'touch' ? 'flex-1' : undefined}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </div>

      {/* BR: a QC failure requires a note. The API rejects it without one, so
          asking here is the difference between a clear form and a red toast. */}
      <Dialog open={failing} onOpenChange={setFailing}>
        <DialogContent className="max-w-md">
          <div>
            <DialogTitle>Why did it fail?</DialogTitle>
            <DialogDescription className="mt-1">
              The garment goes back to Finishing. Tell the tailor exactly what to
              fix.
            </DialogDescription>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-note">Reason</Label>
            <Input
              id="qc-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Left sleeve 2cm short"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setFailing(false);
                setNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!note.trim()}
              loading={act.isPending}
              onClick={() => {
                act.mutate(
                  { taskId: task.id, action: 'qc_fail', note: note.trim() },
                  {
                    onSuccess: () => {
                      setFailing(false);
                      setNote('');
                    },
                  },
                );
              }}
            >
              Send back for rework
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
