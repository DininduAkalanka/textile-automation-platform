import { Order, OrderStatus, OrderStatusHistoryEntry } from '@/types';

const STEPS: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'COMPLETED',
  'DELIVERED',
];

const STEP_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In production',
  QUALITY_CHECK: 'Quality check',
  COMPLETED: 'Completed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

type StepState = 'complete' | 'current' | 'upcoming' | 'skipped';

function stateOf(
  step: OrderStatus,
  currentIndex: number,
  hasProductionTasks: boolean,
): StepState {
  const stepIndex = STEPS.indexOf(step);
  if (stepIndex === currentIndex) return 'current';

  // A fulfillment-only order never enters the floor — showing these two as an
  // ordinary un-reached FUTURE step would claim a garment is being made when
  // nothing ever will be. They are not "next"; they do not apply.
  if (!hasProductionTasks && (step === 'IN_PRODUCTION' || step === 'QUALITY_CHECK')) {
    return 'skipped';
  }

  // Index-based, not "does history contain this status": a QC failure sends the
  // order from QUALITY_CHECK back to IN_PRODUCTION, and at that moment Quality
  // Check has NOT passed — showing it checked off because the order visited it
  // once already would tell the customer something false about right now.
  return stepIndex < currentIndex ? 'complete' : 'upcoming';
}

/** The FIRST time the order reached `step` — when a customer asks "when did
 *  this happen", they mean the first time, not a later QC-fail re-entry. */
function firstReachedAt(
  history: OrderStatusHistoryEntry[],
  step: OrderStatus,
): string | null {
  return history.find((h) => h.toStatus === step)?.createdAt ?? null;
}

/** The LATEST time — used only for the CURRENT step, where "since when has it
 *  been here" should reflect a possible re-entry (e.g. back in production
 *  after rework), not the very first visit hours or days earlier. */
function lastReachedAt(
  history: OrderStatusHistoryEntry[],
  step: OrderStatus,
): string | null {
  const matches = history.filter((h) => h.toStatus === step);
  return matches.length ? matches[matches.length - 1].createdAt : null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Plan Session 7.1, task 3: "vertical tracking stepper ... rendered FROM
 * order_status_history timestamps." Every date shown here comes from a history
 * row, never from `order.updatedAt` or a guess — the acceptance criterion is
 * that the stepper's timestamps EXACTLY mirror those rows.
 */
export function OrderTrackingStepper({ order }: { order: Order }) {
  const history = order.statusHistory ?? [];
  const hasProductionTasks = (order.productionTasks?.length ?? 0) > 0;

  if (order.status === 'CANCELLED') {
    const cancelledAt = history.find((h) => h.toStatus === 'CANCELLED');
    // What the order had actually achieved before it was cancelled — the step
    // just before the CANCELLED row, i.e. the one two positions back in history
    // (CANCELLED's own fromStatus, which the backend records precisely for this).
    const reachedBefore = cancelledAt?.fromStatus;

    return (
      <div
        className="card"
        style={{ padding: '1.5rem', borderLeft: '4px solid #DC2626' }}
      >
        <p style={{ fontWeight: 700, fontSize: '1rem', color: '#991B1B' }}>
          Order cancelled
        </p>
        {reachedBefore && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)', marginTop: '0.25rem' }}>
            It had reached &ldquo;{STEP_LABEL[reachedBefore]}&rdquo; before cancellation.
          </p>
        )}
        {cancelledAt && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-3)', marginTop: '0.5rem' }}>
            {fmtDate(cancelledAt.createdAt)}
          </p>
        )}
        {cancelledAt?.note && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-2)', marginTop: '0.5rem', fontStyle: 'italic' }}>
            &ldquo;{cancelledAt.note}&rdquo;
          </p>
        )}
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(order.status);

  return (
    <ol style={{ position: 'relative', paddingLeft: '2rem' }}>
      {/* The spine. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '9px',
          top: '6px',
          bottom: '6px',
          width: '2px',
          background: 'var(--clr-border-2)',
        }}
      />

      {STEPS.map((step) => {
        const state = stateOf(step, currentIndex, hasProductionTasks);
        if (state === 'skipped') return null; // not "upcoming" — does not apply

        const at =
          state === 'current'
            ? lastReachedAt(history, step)
            : firstReachedAt(history, step);

        return (
          <li key={step} style={{ position: 'relative', paddingBottom: '1.75rem' }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: '-2rem',
                top: '2px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  state === 'complete'
                    ? 'var(--clr-brand)'
                    : state === 'current'
                      ? '#fff'
                      : 'var(--clr-surface-2)',
                border:
                  state === 'current'
                    ? '2px solid var(--clr-brand)'
                    : state === 'complete'
                      ? 'none'
                      : '2px solid var(--clr-border-2)',
              }}
            >
              {state === 'complete' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {state === 'current' && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--clr-brand)',
                  }}
                />
              )}
            </span>

            <p
              style={{
                fontSize: '0.9375rem',
                fontWeight: state === 'upcoming' ? 500 : 700,
                color: state === 'upcoming' ? 'var(--clr-text-3)' : 'var(--clr-text)',
              }}
            >
              {STEP_LABEL[step]}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-3)', marginTop: '0.125rem' }}>
              {at ? fmtDate(at) : state === 'current' ? 'In progress' : 'Not yet'}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
