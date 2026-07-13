import { http, unwrap } from './http';
import {
  Pipeline,
  ProductionTask,
  TaskAction,
  WorkerOption,
} from '@/types/production';

export interface MyTasks {
  queue: ProductionTask[];
  /** Only qc_pass finishes a task (endTime set) — see production.service.ts's
   *  getMyTasks on the backend for why this is a separate list, not a filter
   *  the UI applies to `queue`. */
  completedToday: ProductionTask[];
}

export const productionService = {
  /** Admin board, grouped into the four stage columns. */
  getPipeline: () => unwrap<Pipeline>(http.get('/production/pipeline')),

  /** The signed-in worker's own queue, plus what they finished today. */
  getMyTasks: () => unwrap<MyTasks>(http.get('/production/my-tasks')),

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
