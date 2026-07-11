/** Mirrors the shape ProductionService.shape() returns. */

export type ProductionStage =
  | 'CUTTING'
  | 'STITCHING'
  | 'FINISHING'
  | 'QUALITY_CHECK';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export type TaskAction =
  | 'start'
  | 'complete'
  | 'advance'
  | 'qc_pass'
  | 'qc_fail';

export interface TaskMeasurements {
  personName: string;
  label?: string;
  values: Record<string, number>;
}

export interface ProductionTask {
  id: string;
  orderId: string;
  orderNumber: string;
  stage: ProductionStage;
  status: TaskStatus;
  product: string;
  productType: string;
  quantity: number;
  /** BR3 measurements — the whole reason the floor can cut the cloth. */
  measurements: TaskMeasurements | null;
  worker: { id: string; name: string } | null;
  note: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  ageHours: number;
  /**
   * The server's own list of legal moves. The UI disables buttons from THIS,
   * not from a second copy of the rules — so the board can never offer an action
   * the API would refuse.
   */
  allowedActions: TaskAction[];
}

/** Four columns, always present even when empty. */
export type Pipeline = Record<ProductionStage, ProductionTask[]>;

export interface WorkerOption {
  id: string;
  name: string;
  email: string;
  specialization: ProductionStage | null;
}

export const STAGE_ORDER: ProductionStage[] = [
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'QUALITY_CHECK',
];

export const STAGE_LABEL: Record<ProductionStage, string> = {
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  QUALITY_CHECK: 'Quality Check',
};

export const ACTION_LABEL: Record<TaskAction, string> = {
  start: 'Start',
  complete: 'Mark complete',
  advance: 'Send to next stage',
  qc_pass: 'Pass QC',
  qc_fail: 'Fail QC',
};
