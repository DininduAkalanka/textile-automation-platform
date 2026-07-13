'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Package,
  Truck,
} from 'lucide-react';

import { useMarkPaid, useOrder, useOrderAction } from '@/hooks/use-orders';
import { formatLKR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { OrderMachineAction } from '@/services/orders.service';
import { AdminOrderAction } from '@/types';

const ACTION_ICON: Record<AdminOrderAction['action'], typeof CheckCircle2> = {
  confirm: CheckCircle2,
  cancel: Ban,
  advance: Package,
  deliver: Truck,
  mark_collected: CircleDollarSign,
};

/** The confirm dialog's copy per action (plan 7.1 task 2). Cancel's body is
 *  computed dynamically at the call site (it depends on order.status), so its
 *  entry here is never read — kept for type completeness over Record, not
 *  because the text does anything. */
const DIALOG_COPY: Record<
  AdminOrderAction['action'],
  { title: string; body: string; confirmLabel: string }
> = {
  confirm: {
    title: 'Confirm this order?',
    body: 'Payment will be marked received and the order confirmed — stock is deducted and, if it qualifies, production tasks are created.',
    confirmLabel: 'Confirm order',
  },
  cancel: {
    title: 'Cancel this order?',
    body: '',
    confirmLabel: 'Cancel order',
  },
  advance: {
    title: 'Mark this order fulfilled?',
    body: 'This order has no production tasks — it moves straight to Completed.',
    confirmLabel: 'Mark fulfilled',
  },
  deliver: {
    title: 'Mark this order delivered?',
    body: 'The customer will be notified that their order has arrived.',
    confirmLabel: 'Mark delivered',
  },
  mark_collected: {
    title: 'Mark cash collected?',
    body: 'Records the COD payment as received. The order itself does not change status.',
    confirmLabel: 'Mark collected',
  },
};

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isAuthenticated } = useAuthStore();
  const { data: order, isLoading, isError } = useOrder(id);
  const orderAction = useOrderAction();
  const markPaid = useMarkPaid();

  // ONE dialog for all five actions (plan 7.1 task 2: "all through transition()
  // with confirm dialogs + optional note" — every button, not just Cancel).
  // The refund checkbox is the only per-action variation, gated on the SAME
  // server-computed flag (requiresAcknowledgeRefund) that decides whether the
  // button is destructive at all — nothing here re-derives which action needs it.
  const [pendingAction, setPendingAction] = useState<AdminOrderAction | null>(null);
  const [note, setNote] = useState('');
  const [acknowledgeRefund, setAcknowledgeRefund] = useState(false);
  const [showGatewayResponse, setShowGatewayResponse] = useState(false);

  const busy = orderAction.isPending || markPaid.isPending;

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-2 text-xl font-semibold">Admin access required</h2>
        <Link href="/login" className="text-[#CC0000] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#928E82]">
        <Loader2 size={15} className="animate-spin" aria-hidden />
        Loading order…
      </div>
    );
  }

  if (isError || !order) {
    return <p className="py-20 text-center text-sm text-[#CC0000]">Order not found.</p>;
  }

  const actions = order.adminActions ?? [];

  function closeDialog() {
    setPendingAction(null);
    setNote('');
    setAcknowledgeRefund(false);
  }

  function submitPendingAction() {
    if (!pendingAction || !order) return;
    const trimmedNote = note.trim() || undefined;

    if (pendingAction.action === 'confirm' || pendingAction.action === 'mark_collected') {
      markPaid.mutate(
        { orderId: order.id, note: trimmedNote },
        { onSuccess: closeDialog },
      );
      return;
    }

    orderAction.mutate(
      {
        id: order.id,
        action: pendingAction.action as OrderMachineAction,
        note: trimmedNote,
        acknowledgeRefund,
      },
      { onSuccess: closeDialog },
    );
  }

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#928E82] hover:text-[#0F0F0F]"
      >
        <ArrowLeft size={14} aria-hidden />
        All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F0F0F]">
            {order.orderNumber}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#928E82]">
            Placed{' '}
            {new Date(order.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span className="rounded-full bg-[#0F0F0F] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
          {order.status.replace('_', ' ')}
        </span>
      </div>

      {/* ─── Action bar — the single source is order.adminActions ──────────
          Every button opens the SAME confirm dialog (plan 7.1 task 2) — none
          of them fire on click. The dialog is where the mutation actually runs. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.action];

          return (
            <button
              key={action.action}
              disabled={!action.allowed || busy}
              title={action.reason ?? undefined}
              onClick={() => setPendingAction(action)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
                action.destructive
                  ? 'border-[#CC0000]/30 bg-white text-[#CC0000] hover:bg-[#CC0000] hover:text-white disabled:hover:bg-white disabled:hover:text-[#CC0000]'
                  : 'border-[#EAE8E1] bg-white text-[#0F0F0F] hover:border-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white disabled:hover:bg-white disabled:hover:text-[#0F0F0F]',
              )}
            >
              <Icon size={14} aria-hidden />
              {action.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* Items + measurements */}
          <Card title="Items">
            {order.items?.map((item) => (
              <div key={item.id} className="border-b border-[#F4F3EF] py-3 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[#0F0F0F]">
                      {item.product?.name ?? 'Product'}
                    </p>
                    <p className="text-[12px] text-[#928E82]">
                      Qty {item.quantity} × {formatLKR(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold tabular-nums text-[#0F0F0F]">
                    {formatLKR(item.totalPrice)}
                  </p>
                </div>
                {item.measurements && (
                  <div className="mt-2 rounded-lg bg-[#FAFAF8] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#928E82]">
                      Measurements — {item.measurements.personName}
                    </p>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 sm:grid-cols-4">
                      {Object.entries(item.measurements.values).map(([k, v]) => (
                        <p key={k} className="text-[11px] text-[#6E6A5E]">
                          <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>:{' '}
                          <strong className="text-[#0F0F0F]">{v}cm</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>

          {/* Production timeline widget (plan 6.2 task 4, reused here per 7.1 task 1) */}
          {order.productionTasks && order.productionTasks.length > 0 && (
            <Card title="Production">
              <div className="flex flex-col gap-2">
                {order.productionTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg bg-[#FAFAF8] px-3 py-2"
                  >
                    <span className="text-[12px] font-medium text-[#0F0F0F]">
                      {task.stage.replace('_', ' ')} · {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-[#928E82]">
                      {task.worker
                        ? `${task.worker.user.firstName} ${task.worker.user.lastName}`
                        : 'Unassigned'}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/admin/production"
                className="mt-2 inline-block text-[11px] font-medium text-[#CC0000] hover:underline"
              >
                Open the production board →
              </Link>
            </Card>
          )}

          {/* Shipping address */}
          <Card title="Shipping address">
            <p className="text-[13px] leading-relaxed text-[#4A4740]">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.addressLine1}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
            </p>
          </Card>

          {/* Full status history feed — who/when/note */}
          <Card title="History">
            <div className="flex flex-col gap-2.5">
              {(order.statusHistory ?? []).map((h) => (
                <div key={h.id} className="text-[12px] text-[#6E6A5E]">
                  <span className="font-semibold text-[#0F0F0F]">{h.toStatus}</span>
                  {' — '}
                  {new Date(h.createdAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  <span className="italic">{h.changedByName ?? 'System'}</span>
                  {h.note && <span> — &ldquo;{h.note}&rdquo;</span>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* Customer */}
          <Card title="Customer">
            <p className="text-[13px] font-medium text-[#0F0F0F]">
              {order.user?.firstName} {order.user?.lastName}
            </p>
            <p className="text-[12px] text-[#928E82]">{order.user?.email}</p>
          </Card>

          {/* Payment — status, method, gateway evidence */}
          <Card title="Payment">
            {order.payment ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#0F0F0F]">
                    {order.payment.method}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                      order.payment.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : order.payment.status === 'FAILED'
                          ? 'bg-[#FFF5F5] text-[#A80000]'
                          : order.payment.status === 'REFUNDED'
                            ? 'bg-[#F4F3EF] text-[#6E6A5E]'
                            : 'bg-[#FDF6E7] text-[#8A6A17]',
                    )}
                  >
                    {order.payment.status}
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#0F0F0F]">
                  {formatLKR(order.payment.amount)}
                </p>
                {order.payment.transactionId && (
                  <p className="mt-1 font-mono text-[11px] text-[#928E82]">
                    {order.payment.transactionId}
                  </p>
                )}

                {/* Webhook/gateway evidence — the raw payload the gateway sent,
                    not a fabricated "slip viewer" nothing in this system produces. */}
                {order.payment.gatewayResponse && (
                  <div className="mt-3 border-t border-[#F4F3EF] pt-3">
                    <button
                      onClick={() => setShowGatewayResponse((v) => !v)}
                      className="flex w-full items-center justify-between text-[11px] font-medium text-[#928E82] hover:text-[#0F0F0F]"
                    >
                      Gateway response
                      <ChevronDown
                        size={12}
                        className={cn('transition-transform', showGatewayResponse && 'rotate-180')}
                        aria-hidden
                      />
                    </button>
                    {showGatewayResponse && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[#0F0F0F] p-2.5 text-[10px] leading-relaxed text-white/70">
                        {JSON.stringify(order.payment.gatewayResponse, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[#928E82]">No payment record yet.</p>
            )}
          </Card>
        </div>
      </div>

      {/* The ONE confirm dialog every action opens (plan 7.1 task 2). The refund
          checkbox is the only thing that varies by action, gated on the same
          server-computed flag that decided whether to show it at all — there is
          no second, client-side copy of "does this action need that checkbox". */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[15px] font-semibold text-[#0F0F0F]">
              {DIALOG_COPY[pendingAction.action].title}
            </h2>
            <p className="mt-1 text-[13px] text-[#928E82]">
              {pendingAction.action === 'cancel'
                ? `Stock will be ${order.status === 'PENDING' ? 'released' : 'returned to available'}. This cannot be undone.`
                : DIALOG_COPY[pendingAction.action].body}
            </p>

            {pendingAction.requiresAcknowledgeRefund && (
              <label className="mt-4 flex items-start gap-2.5 rounded-lg bg-[#FFF5F5] p-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={acknowledgeRefund}
                  onChange={(e) => setAcknowledgeRefund(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[#A80000]">
                  This order is paid in full. I acknowledge that a refund must be issued
                  manually — cancelling does not refund the customer automatically.
                </span>
              </label>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional, visible to you and the customer)"
              rows={2}
              className="mt-3 w-full rounded-lg border border-[#EAE8E1] p-2.5 text-[13px] outline-none focus:border-[#0F0F0F]"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeDialog}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6E6A5E] hover:bg-[#F4F3EF]"
              >
                Never mind
              </button>
              <button
                onClick={submitPendingAction}
                disabled={busy || (pendingAction.requiresAcknowledgeRefund && !acknowledgeRefund)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-[#D5D2C8]',
                  pendingAction.destructive
                    ? 'bg-[#CC0000] hover:bg-[#A80000]'
                    : 'bg-[#0F0F0F] hover:bg-black',
                )}
              >
                {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
                {DIALOG_COPY[pendingAction.action].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#EAE8E1] bg-white p-5 shadow-[0_1px_2px_rgba(74,71,64,0.04)]">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#928E82]">
        {title}
      </h2>
      {children}
    </div>
  );
}
