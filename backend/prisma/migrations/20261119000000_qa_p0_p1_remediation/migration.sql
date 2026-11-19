-- QA remediation (P0/P1 findings of 2026-11-19).
--
-- Every change here backs a fix in the service layer; each block says which.

BEGIN;

-- ─── P1-1: only a VERIFIED PayHere event may claim the idempotency key ───────
-- The old unique index covered every row, so an unsigned (forged) notify that
-- arrived first claimed (gateway, transaction_id, event_status) and the real,
-- correctly signed notify was then dropped as a "duplicate" — a paid order
-- stayed PENDING forever. Dedupe is now enforced only among signature-valid
-- events. Forged events are still stored for the audit trail; they just can no
-- longer block anything. (A partial index cannot be expressed in
-- schema.prisma; like products_search_vector_idx it lives in SQL only.)
DROP INDEX IF EXISTS "payment_webhook_events_gateway_transaction_id_event_status_key";
CREATE UNIQUE INDEX "payment_webhook_events_verified_dedupe_key"
  ON "payment_webhook_events" ("gateway", "transaction_id", "event_status")
  WHERE "signature_valid";
CREATE INDEX "payment_webhook_events_gateway_transaction_id_event_status_idx"
  ON "payment_webhook_events" ("gateway", "transaction_id", "event_status");

-- ─── P1-4: per-account failed-login lockout ─────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3);

-- ─── P1-8: claiming a squatted account through a reset link ─────────────────
-- Records which contact a reset link was delivered to, so completing the reset
-- can mark THAT contact verified (receiving the link proves ownership).
ALTER TABLE "users" ADD COLUMN "reset_channel" "VerificationChannel";

-- ─── P1-8: guest one-time codes keyed to a CONTACT, not to a user ───────────
-- A guest must be able to verify an email/phone BEFORE any account exists, so
-- that no account is created for a contact nobody has proved they own.
CREATE TABLE "contact_verification_codes" (
    "id"          UUID NOT NULL,
    "contact"     TEXT NOT NULL,
    "channel"     "VerificationChannel" NOT NULL,
    "code_hash"   TEXT NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_verification_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contact_verification_codes_contact_channel_created_at_idx"
  ON "contact_verification_codes" ("contact", "channel", "created_at");

-- ─── P0-2: per-IP cap on open unpaid guest orders ───────────────────────────
-- Set only for guest checkouts; used to refuse a fresh guest order from an
-- address that already holds several unpaid reservations.
ALTER TABLE "orders" ADD COLUMN "client_ip" TEXT;
CREATE INDEX "orders_client_ip_status_created_at_idx"
  ON "orders" ("client_ip", "status", "created_at");

-- ─── P1-7: each installment records its own gateway transaction ─────────────
ALTER TABLE "installments" ADD COLUMN "transaction_id" TEXT;
CREATE INDEX "installments_transaction_id_idx" ON "installments" ("transaction_id");

-- ─── P1-7: this is an LKR shop ──────────────────────────────────────────────
-- Every amount ever stored is an order total in rupees; the "USD" label came
-- from the legacy Stripe mock path. Correct the label, and the default.
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'LKR';
UPDATE "payments" SET "currency" = 'LKR' WHERE "currency" = 'USD';

-- ─── P1-2: money on a CANCELLED order is not revenue (AI analytics) ─────────
-- Every AI revenue query filters `payment_status = 'COMPLETED'`. A payment that
-- lands on an order that was already cancelled is money to REFUND, not sales —
-- so the view reports it as 'VOID'. Same columns, same order, same types, so
-- CREATE OR REPLACE keeps the existing GRANT to textile_ai_readonly.
CREATE OR REPLACE VIEW ai_sales_facts AS
SELECT o.id                                   AS order_id,
       o.order_number,
       o.status::text                         AS order_status,
       o.created_at                           AS ordered_at,
       CASE WHEN o.status = 'CANCELLED' THEN 'VOID'
            ELSE pay.status::text END         AS payment_status,
       COALESCE(pay.paid_at, pay.created_at)  AS paid_at,
       oi.product_id,
       pr.name                                AS product_name,
       pr.product_type::text                  AS product_type,
       oi.quantity,
       oi.unit_price,
       oi.total_price                         AS line_revenue,
       pr.cost_price,
       (oi.quantity * pr.cost_price)          AS line_cost
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products pr    ON pr.id = oi.product_id
  LEFT JOIN payments pay ON pay.order_id = o.id;

COMMIT;
