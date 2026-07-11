import { http, unwrap } from './http';
import {
  Pipeline,
  ProductionTask,
  TaskAction,
  WorkerOption,
} from '@/types/production';

export const productionService = {
  /** Admin board, grouped into the four stage columns. */
  getPipeline: () => unwrap<Pipeline>(http.get('/production/pipeline')),

  /** The signed-in worker's own queue. */
  getMyTasks: () => unwrap<ProductionTask[]>(http.get('/production/my-tasks')),

  getWorkers: () => unwrap<WorkerOption[]>(http.get('/production/workers')),

  /** BR5: assignment is what makes a task startable. */
  assign: (taskId: string, workerId: string) =>
    unwrap<ProductionTask>(
      http.put(`/production/tasks/${taskId}/assign`, { workerId }),
    ),

  act: (taskId: string, action: TaskAction, note?: string) =>
    unwrap<ProductionTask>(
      http.put(`/production/tasks/${taskId}/status`, { action, note }),
    ),
};
