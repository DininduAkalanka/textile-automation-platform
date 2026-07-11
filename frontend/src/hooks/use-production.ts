'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { productionService } from '@/services/production.service';
import { ACTION_LABEL, TaskAction } from '@/types/production';

export const productionKeys = {
  pipeline: ['production', 'pipeline'] as const,
  myTasks: ['production', 'my-tasks'] as const,
  workers: ['production', 'workers'] as const,
};

/**
 * A task move changes BOTH the admin board and the worker's queue (and the
 * order's status). Rather than reason about which, every mutation invalidates
 * both lists — the factory floor is small and correctness beats a saved request.
 */
function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: productionKeys.pipeline });
    void queryClient.invalidateQueries({ queryKey: productionKeys.myTasks });
  };
}

export function usePipeline() {
  return useQuery({
    queryKey: productionKeys.pipeline,
    queryFn: productionService.getPipeline,
    // Several people move the same board at once; a stale column is confusing.
    refetchInterval: 30_000,
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: productionKeys.myTasks,
    queryFn: productionService.getMyTasks,
    refetchInterval: 30_000,
    // A worker leaves the phone in a pocket and comes back; refetch on return.
    refetchOnWindowFocus: true,
  });
}

export function useWorkers() {
  return useQuery({
    queryKey: productionKeys.workers,
    queryFn: productionService.getWorkers,
    staleTime: 5 * 60_000, // the roster barely changes
  });
}

export function useAssignTask() {
  const invalidate = useInvalidateTasks();

  return useMutation({
    mutationFn: ({ taskId, workerId }: { taskId: string; workerId: string }) =>
      productionService.assign(taskId, workerId),
    onSuccess: (task) => {
      toast.success(`Assigned to ${task.worker?.name ?? 'worker'}`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useTaskAction() {
  const invalidate = useInvalidateTasks();

  return useMutation({
    mutationFn: ({
      taskId,
      action,
      note,
    }: {
      taskId: string;
      action: TaskAction;
      note?: string;
    }) => productionService.act(taskId, action, note),
    onSuccess: (task, { action }) => {
      toast.success(`${ACTION_LABEL[action]} — ${task.product}`);
      invalidate();
    },
    // The API refuses illegal moves (422) and unassigned starts (BR5, 400).
    // Surfacing its message verbatim means the floor sees the real reason.
    onError: (error: Error) => toast.error(error.message),
  });
}
