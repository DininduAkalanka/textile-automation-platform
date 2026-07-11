import { ProductionStage, TaskStatus } from '@prisma/client';

import {
  IllegalTaskTransition,
  TaskAction,
  allowedActions,
  applyAction,
  isFinalStage,
  nextStage,
} from './production.machine';

/**
 * The production task machine (plan §4.3).
 *
 * These tests are the specification. The service is not allowed to decide a
 * stage or a status for itself — it maps whatever this returns onto the row — so
 * if a rule is not here, it does not exist.
 */
describe('production task machine', () => {
  const at = (stage: ProductionStage, status: TaskStatus) => ({
    stage,
    status,
  });

  const CUTTING = ProductionStage.CUTTING;
  const STITCHING = ProductionStage.STITCHING;
  const FINISHING = ProductionStage.FINISHING;
  const QC = ProductionStage.QUALITY_CHECK;

  const PENDING = TaskStatus.PENDING;
  const IN_PROGRESS = TaskStatus.IN_PROGRESS;
  const DONE = TaskStatus.DONE;

  describe('the happy path: a garment from cloth to inspected', () => {
    it('walks CUTTING → STITCHING → FINISHING → QC and passes', () => {
      let state = at(CUTTING, PENDING);

      // Cutting
      state = applyAction('start', state);
      expect(state).toMatchObject({ stage: CUTTING, status: IN_PROGRESS });

      state = applyAction('complete', state);
      expect(state).toMatchObject({ stage: CUTTING, status: DONE });

      // Advancing reaches the next stage but does NOT start it.
      state = applyAction('advance', state);
      expect(state).toMatchObject({ stage: STITCHING, status: PENDING });

      // Stitching
      state = applyAction('complete', applyAction('start', state));
      state = applyAction('advance', state);
      expect(state).toMatchObject({ stage: FINISHING, status: PENDING });

      // Finishing
      state = applyAction('complete', applyAction('start', state));
      state = applyAction('advance', state);
      expect(state).toMatchObject({ stage: QC, status: PENDING });

      // Quality control
      state = applyAction('start', state);
      const passed = applyAction('qc_pass', state);

      expect(passed).toMatchObject({ stage: QC, status: DONE });
      // finishes → the service stamps end_time.
      expect(passed.finishes).toBe(true);
    });

    it('stamps start on the first start, and end only when QC passes', () => {
      expect(applyAction('start', at(CUTTING, PENDING)).starts).toBe(true);
      expect(
        applyAction('complete', at(CUTTING, IN_PROGRESS)).finishes,
      ).toBeUndefined();

      const passed = applyAction('qc_pass', at(QC, IN_PROGRESS));
      expect(passed.finishes).toBe(true);
    });
  });

  describe('quality control failure — the only backwards edge', () => {
    it('sends the task back to FINISHING/PENDING, not IN_PROGRESS', () => {
      const failed = applyAction('qc_fail', at(QC, IN_PROGRESS));

      expect(failed).toMatchObject({ stage: FINISHING, status: PENDING });
      // PENDING because the rework has not begun — a worker must pick it up again.
      expect(failed.status).not.toBe(IN_PROGRESS);
    });

    it('demands a note, so the floor knows what to fix', () => {
      expect(applyAction('qc_fail', at(QC, IN_PROGRESS)).requiresNote).toBe(
        true,
      );
    });

    it('can be re-worked and re-inspected (the loop closes)', () => {
      let state = applyAction('qc_fail', at(QC, IN_PROGRESS));

      state = applyAction('complete', applyAction('start', state));
      state = applyAction('advance', state);
      expect(state).toMatchObject({ stage: QC, status: PENDING });

      const passed = applyAction('qc_pass', applyAction('start', state));
      expect(passed).toMatchObject({ stage: QC, status: DONE });
    });
  });

  describe('illegal transitions throw', () => {
    const illegal: Array<[TaskAction, ProductionStage, TaskStatus, string]> = [
      ['start', CUTTING, IN_PROGRESS, 'starting work already in progress'],
      ['start', CUTTING, DONE, 'restarting finished work'],
      ['complete', CUTTING, PENDING, 'completing work never started'],
      ['complete', CUTTING, DONE, 'completing twice'],
      ['advance', CUTTING, PENDING, 'advancing before doing the work'],
      ['advance', CUTTING, IN_PROGRESS, 'advancing mid-cut'],
      ['advance', QC, DONE, 'advancing past the final stage'],
      ['qc_pass', CUTTING, IN_PROGRESS, 'passing QC while still cutting'],
      ['qc_fail', FINISHING, IN_PROGRESS, 'failing QC before it reaches QC'],
      ['qc_pass', QC, PENDING, 'passing QC without inspecting it'],
      ['qc_fail', QC, PENDING, 'failing QC without inspecting it'],
    ];

    it.each(illegal)('refuses %s at %s/%s — %s', (action, stage, status) => {
      expect(() => applyAction(action, at(stage, status))).toThrow(
        IllegalTaskTransition,
      );
    });

    it('a DONE task at QC is terminal — nothing moves it', () => {
      expect(allowedActions(at(QC, DONE))).toEqual([]);
    });

    /**
     * The important one. `complete` is legal at every stage EXCEPT quality
     * control. If it were legal there, an inspector could mark the task DONE at
     * QC without rendering a verdict — and since syncOrderStatus reads "every
     * task DONE at QC" as COMPLETED, the order would ship as inspected when
     * nobody had inspected it. QC has exactly two exits: pass, or fail.
     */
    it('refuses `complete` at QC — a garment cannot skip its verdict', () => {
      expect(() => applyAction('complete', at(QC, IN_PROGRESS))).toThrow(
        IllegalTaskTransition,
      );

      // ...but it remains the normal way to finish every other stage.
      expect(applyAction('complete', at(FINISHING, IN_PROGRESS))).toMatchObject(
        {
          stage: FINISHING,
          status: DONE,
        },
      );
    });
  });

  describe('allowedActions drives the UI from the same rules as the API', () => {
    it('offers only start on a fresh task', () => {
      expect(allowedActions(at(CUTTING, PENDING))).toEqual(['start']);
    });

    it('offers only complete on work in progress', () => {
      expect(allowedActions(at(CUTTING, IN_PROGRESS))).toEqual(['complete']);
    });

    it('offers only advance on completed non-final work', () => {
      expect(allowedActions(at(FINISHING, DONE))).toEqual(['advance']);
    });

    it('offers pass and fail — and nothing else — during inspection', () => {
      expect(allowedActions(at(QC, IN_PROGRESS)).sort()).toEqual([
        'qc_fail',
        'qc_pass',
      ]);
    });
  });

  describe('stage order', () => {
    it('runs cutting → stitching → finishing → quality check', () => {
      expect(nextStage(CUTTING)).toBe(STITCHING);
      expect(nextStage(STITCHING)).toBe(FINISHING);
      expect(nextStage(FINISHING)).toBe(QC);
      expect(nextStage(QC)).toBeNull();
    });

    it('knows QC is the end of the line', () => {
      expect(isFinalStage(QC)).toBe(true);
      expect(isFinalStage(FINISHING)).toBe(false);
    });
  });
});
