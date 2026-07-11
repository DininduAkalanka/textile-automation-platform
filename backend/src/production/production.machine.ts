import { ProductionStage, TaskStatus } from '@prisma/client';

/**
 * The production task state machine (plan §4.3, BR6).
 *
 *   stage:   CUTTING → STITCHING → FINISHING → QUALITY_CHECK
 *   status:  PENDING → IN_PROGRESS → DONE   (within a single stage)
 *
 * Advancing a stage resets status to PENDING — the next stage has not been
 * started, it has merely become the current one.
 *
 * A QC failure sends the task back to FINISHING/PENDING with a mandatory note.
 * That is the only backwards edge in the machine, and it is why `advance` and
 * `qc_pass` are distinct actions: passing QC means the garment is finished,
 * advancing out of FINISHING means it is ready to be inspected.
 *
 * Kept as pure functions so the rules can be tested without a database, and so
 * the service layer never hand-assigns a stage or status (the same discipline
 * the order machine uses via transition()).
 */

export type TaskAction =
  | 'start'
  | 'complete'
  | 'advance'
  | 'qc_pass'
  | 'qc_fail';

export const STAGE_ORDER: readonly ProductionStage[] = [
  ProductionStage.CUTTING,
  ProductionStage.STITCHING,
  ProductionStage.FINISHING,
  ProductionStage.QUALITY_CHECK,
];

export interface TaskState {
  stage: ProductionStage;
  status: TaskStatus;
}

export interface TaskTransition extends TaskState {
  /** Set when the action starts work, so the service can stamp start_time. */
  starts?: boolean;
  /** Set when the task is finished for good, so the service can stamp end_time. */
  finishes?: boolean;
  /** True when the action REQUIRES a note (QC failure). */
  requiresNote?: boolean;
}

export class IllegalTaskTransition extends Error {
  constructor(action: TaskAction, state: TaskState) {
    super(
      `Cannot ${action} a task that is ${state.status} at stage ${state.stage}`,
    );
    this.name = 'IllegalTaskTransition';
  }
}

export function nextStage(stage: ProductionStage): ProductionStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  if (index === -1 || index === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1];
}

export function isFinalStage(stage: ProductionStage): boolean {
  return stage === ProductionStage.QUALITY_CHECK;
}

/**
 * Applies `action` to `state`, or throws IllegalTaskTransition.
 *
 * Every legal edge in the machine is here and nowhere else — the service maps
 * the result onto the row rather than deciding anything itself.
 */
export function applyAction(
  action: TaskAction,
  state: TaskState,
): TaskTransition {
  const { stage, status } = state;

  switch (action) {
    // Begin work on the current stage. BR5 (an assignee is required) is enforced
    // by the service, which knows the row; the machine only knows the states.
    case 'start':
      if (status !== TaskStatus.PENDING) {
        throw new IllegalTaskTransition(action, state);
      }
      return { stage, status: TaskStatus.IN_PROGRESS, starts: true };

    // Work on this stage is finished.
    //
    // Deliberately ILLEGAL at QUALITY_CHECK. Allowing it there would let an
    // inspector mark a task DONE at the final stage without ever rendering a
    // verdict — and because syncOrderStatus reads "every task DONE at QC" as
    // COMPLETED, the order would ship as inspected when nobody inspected it.
    // At QC the only ways out are qc_pass and qc_fail.
    case 'complete':
      if (status !== TaskStatus.IN_PROGRESS || isFinalStage(stage)) {
        throw new IllegalTaskTransition(action, state);
      }
      return { stage, status: TaskStatus.DONE };

    // Hand the garment to the next stage. Only from a completed, non-final stage.
    case 'advance': {
      if (status !== TaskStatus.DONE || isFinalStage(stage)) {
        throw new IllegalTaskTransition(action, state);
      }
      const next = nextStage(stage);
      if (!next) throw new IllegalTaskTransition(action, state);
      // The next stage has not been started, only reached.
      return { stage: next, status: TaskStatus.PENDING };
    }

    // Quality control accepts the garment: the task is finished for good.
    case 'qc_pass':
      if (!isFinalStage(stage) || status !== TaskStatus.IN_PROGRESS) {
        throw new IllegalTaskTransition(action, state);
      }
      return { stage, status: TaskStatus.DONE, finishes: true };

    // Quality control rejects it: back to FINISHING with a mandatory note.
    // Status PENDING, not IN_PROGRESS — the rework has not begun.
    case 'qc_fail':
      if (!isFinalStage(stage) || status !== TaskStatus.IN_PROGRESS) {
        throw new IllegalTaskTransition(action, state);
      }
      return {
        stage: ProductionStage.FINISHING,
        status: TaskStatus.PENDING,
        requiresNote: true,
      };

    default: {
      const exhaustive: never = action;
      throw new Error(`Unknown task action: ${String(exhaustive)}`);
    }
  }
}

/** Every action legal from `state`. Drives disabled-with-reason buttons in the UI. */
export function allowedActions(state: TaskState): TaskAction[] {
  const actions: TaskAction[] = [
    'start',
    'complete',
    'advance',
    'qc_pass',
    'qc_fail',
  ];

  return actions.filter((action) => {
    try {
      applyAction(action, state);
      return true;
    } catch {
      return false;
    }
  });
}
