# IMPLEMENTATION PLAN — V2 (Execution Plan)
# Smart Textile Business Management & AI E-Commerce Platform

**Type:** Execution-grade implementation plan, grounded in the *current* codebase
**Supersedes for execution:** `IMPLEMENTATION_PLAN.md` (V1) remains the design reference; this V2 reconciles it with (a) the code that actually exists today and (b) a full read of design docs 00–13 + CODING_STANDARDS.
**Prepared by:** Lead engineering review
**Authoritative sources, in precedence order:** SRS (doc 03) → Business Requirements (doc 01) → the other design docs → V1 ADL → this document's Decision Log (which resolves conflicts between them).

---

## 0. How to use this document

1. Read **§2 Decision Log** first — it resolves the contradictions found in the audit. Every phase assumes those rulings.
2. **§1** is the honest "you are here" (evidence-based, with commit hashes).
3. **§4** is the dependency-ordered roadmap of *remaining* work. Each phase is demoable and has explicit acceptance criteria.
4. Two decisions are marked **⚠ NEEDS RATIFICATION** — they change scope/effort and are the owner's/supervisor's call. Everything else I've decided and justified.

---

## 1. Executive assessment — current state (evidence-based)

The project is **not greenfield**. A working slice already exists and, over the recent hardening pass, the **payment + inventory core has been brought to a genuinely production-grade, doc-conformant state** and verified end-to-end against a running database.

### 1.1 Built & verified (this branch, `fix/critical-payment-idor-and-stock-race`)
| Area | State | Evidence |
|---|---|---|
| Security: payment IDOR + stock-oversell race | fixed + regression-tested | `bd8ac0f`, `8ca87a5` |
| Security: JWT secret fail-fast (no hardcoded fallback) | fixed | `6856022` |
| Inventory ledger (D2/D3): `inventory` + `inventory_movements` + BR4 CHECK | schema + backfill, drift=0 | `80f4ae6` |
| Reserve → deduct → release lifecycle + `order_status_history` (D4) | rewired, idempotent SALE, e2e-verified | `f4bbe1b` |
| PayHere initiation + **idempotent** notify webhook (D5) + COD, LKR | e2e-verified (dup→1 SALE, amount+sig blocked) | `a3c29fd` |
| Checkout payment-method selection (Card/COD/Installment), LKR | wired, tsc clean, route renders | `9b9cc99` |
| Admin payment mgmt (list, mark-paid, reject) + `/admin/payments` UI | e2e-verified + RBAC 403 | `543b258`, `33d7573` |
| Runnable baseline (docker Postgres → migrate → seed → both apps boot) | verified | — |

### 1.2 Feature coverage vs the docs' MVP (Scope §6)
- **Done:** Auth (basic), Catalog (browse/detail), Cart, Order creation, **Payment (PayHere+COD)**, **Inventory ledger**.
- **Partial:** Admin (dashboard is a placeholder; payments UI done).
- **Missing:** Production tracking, Measurements (BR3), Dashboard analytics, AI assistants, Deployment/CI.

### 1.3 The honest gaps (from the full-doc audit)
1. **Order-status enum** diverges from *all* docs (missing `IN_PRODUCTION`/`QUALITY_CHECK`/`COMPLETED`). → **DR-2**.
2. **Payment-status enum** is a *doc-vs-doc contradiction* (SRS says `COMPLETED`, doc 11 says `PAID`). → **DR-1**.
3. **Frontend uses no shadcn/ui** (docs 05 + 10 + CODING_STANDARDS mandate it). → **DR-3 ⚠**.
4. **Auth hardening incomplete:** no refresh-token rotation, no rate limiting (doc 09). → **DR-4**.
5. **RBAC lacks a `WORKER` role** (all docs specify Customer/Admin/Worker). → **DR-5**.
6. **BR3 (custom orders require measurements) not enforced;** measurements not modeled. → **DR-10**.
7. No API versioning (`/api/v1`), no CI/CD, `db push` instead of migrations.

**Verdict:** the foundation under payments/inventory is solid and ahead of spec on correctness; the remaining work is (a) a focused *foundation realign* to close the conformance gaps cheaply now, then (b) the un-built MVP phases (production → dashboard → AI → deploy).

---

## 2. Decision Log (V2) — resolves the contradictions

These are binding for all phases. Each records the conflict and the ruling.

### DR-1 — Payment status enum = keep SRS canonical (`PENDING, COMPLETED, FAILED, REFUNDED`)
**Conflict:** SRS FR-015 + Scope §3.6 + current code use `COMPLETED`; doc 11 §8 and V1-D4 use `PAID`/`PROCESSING`.
**Ruling:** Keep `COMPLETED` — the SRS is the declared "official technical contract" (doc 03 §1.1) and it matches 2 of 3 docs and the code, so realigning to `PAID` would create churn *and* break from the SRS. **Add `PROCESSING` only when bank-transfer lands** (represents "slip uploaded, awaiting admin verification") as an additive, non-breaking enum value. No rename now.

### DR-2 — Order status enum = realign to the docs (breaking, do it NOW)
**Conflict:** Code uses `PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED`; docs 02/03 and V1-D4/D8 specify `PENDING→CONFIRMED→IN_PRODUCTION→QUALITY_CHECK→COMPLETED→DELIVERED`.
**Ruling:** Realign to the doc-canonical machine. Retail-only orders skip production (`CONFIRMED→COMPLETED→DELIVERED`); production orders traverse the full chain (driven by Phase E). Do this **before** Phase E (production depends on the states) and before more order data accumulates. Migration remaps `PROCESSING→IN_PRODUCTION`, `SHIPPED→COMPLETED`; dev DB is re-seedable. `CANCELLED` retained (allowed from PENDING/CONFIRMED-pre-production).

### DR-3 — Frontend design system ⚠ **NEEDS RATIFICATION**
**Conflict:** Docs 05 + 10 + CODING_STANDARDS mandate Tailwind + **shadcn/ui + Radix**; the existing ~12 pages are hand-styled with a CSS-variable token system, no shadcn.
**Options:**
- **A. Full migration** to shadcn/ui — highest spec-fidelity, but weeks of rewriting *working* UI for low functional gain.
- **B. Hybrid (recommended).** Formalize the existing CSS tokens into a documented design system; adopt shadcn/ui + Radix for **net-new complex/admin components** (data tables, dialogs, forms) where accessibility (doc 10 §11, WCAG 2.1) matters most; do **not** rewrite working customer pages.
- **C. Formal deviation.** Accept the hand-styled system, document the deviation.
**Recommendation:** **B**, unless the supervisor's rubric hard-requires shadcn across the board — in which case schedule a dedicated migration phase. This is the single largest doc divergence and carries *academic-grading* risk, so it must be an explicit, owner-ratified decision, not a silent choice.

### DR-4 — Implement auth hardening (D6): refresh tokens + rate limiting
**Ruling:** Access JWT 15 min (in-memory) + refresh token (7 d, rotated) in an httpOnly Secure SameSite=Lax cookie with a **SHA-256 hash in a new `refresh_tokens` table** (revocable, reuse-detection). Add `@nestjs/throttler` (20/min auth, 100/min default). Add `GET /auth/me` (alias of the current `/auth/profile`). Required by docs 07 §14 and 09 §3/§5/§9.

### DR-5 — RBAC roles = `CUSTOMER, ADMIN, WORKER` (+ optional `MANAGER`)
**Ruling:** Add `WORKER` (needed by Phase E — workers log in to see tasks). Keep `MANAGER` only if a concrete admin-tier need exists; otherwise fold into `ADMIN`. `@Roles` + `RolesGuard` already exist and are reused.

### DR-6 — Adopt `/api/v1` prefix
**Ruling:** Change the Nest global prefix to `api/v1` and the frontend base URL accordingly, during the foundation realign (cheap now, painful later). Matches doc 07 §2/§16.

### DR-7 — Repository strategy = keep `frontend/` + `backend/` split
**Ruling:** Do **not** migrate to the V1-D1 pnpm monorepo mid-project. Introduce a lightweight shared-types package only if FE/BE enum drift becomes a real problem. (Prior decision, reaffirmed.)

### DR-8 — Stock units = `Int` (owner decision, ratified)
Discrete garments, matches the existing schema and seed. Revisit only if fabric-by-the-metre is sold (would move inventory/order quantities to `Decimal`).

### DR-9 — AI = whitelisted function-calling + Postgres FTS (V1-D9/D10), NOT text-to-SQL
**Ruling:** Doc 08 draws the Business AI as LLM→SQL aggregation; that is a security/reliability hazard. Supersede with V1-D9 (≈6 parameterized, read-only analytics tools selected via native function-calling; the LLM never emits SQL) and V1-D10 (Postgres `tsvector` FTS retriever now, pgvector later). The LLM may only reference product IDs present in the retrieved set; the API validates IDs before responding (doc 09 §8, hallucination-proof). Latest Claude models for the LLM layer.

### DR-10 — Enforce BR3 (measurements) in the catalog/cart/order flow
**Ruling:** Model `customer_measurements`; `requires_measurement` products block checkout until measurements are supplied; measurements stored as JSONB on the order item (per doc 06 §9). Built in Phase B.

---

## 3. Conformance matrix (condensed)

| Doc | Requirement | Status | Closed by |
|---|---|---|---|
| 01 §7 | BR1 stock validation, BR2 verify-before-paid, BR4 non-negative, BR6 workflow | ✅ | done |
| 01 §7 | BR3 measurements | ❌ | Phase B (DR-10) |
| 01 §7 | BR5 task→worker | ⏳ | Phase E |
| 02/03 | Order status lifecycle | ⚠ | Phase A (DR-2) |
| 03 FR-015 | Payment status | ✅ (SRS) | DR-1 |
| 09 | JWT+bcrypt ✅; refresh tokens + rate-limit ❌ | ⚠ | Phase A (DR-4) |
| 09/07 | RBAC Customer/Admin/Worker | ⚠ | Phase A (DR-5) |
| 11/07/13 | PayHere + COD + webhook idempotency + payment security tests | ✅ | done |
| 11 §4.3 | Bank transfer + slip | ⏳ | Phase C |
| 06 | inventory ledger ✅; customers/addresses/measurements/images/workers split | ⚠ | Phases A/B/E |
| 05/10 | shadcn/ui design system | ❌ | DR-3 ⚠ |
| 07 §2 | `/api/v1` | ❌ | Phase A (DR-6) |
| 02/03 §3.7 | Production tracking | ⏳ | Phase E |
| 02 §3.8 | Dashboard analytics + reports | ⏳ | Phase G |
| 08 | Dual AI assistants | ⏳ | Phase H (DR-9) |
| 12/13 | CI/CD, deploy, E2E/load tests | ⏳ | Phases A/I |

---

## 4. Phase roadmap (dependency-ordered, current-state-aware)

> Each phase ends demoable. "AC" = acceptance criteria (the Definition of Done gate in §5 applies on top).

### Phase A — Foundation Realign & Hardening  *(do first; unblocks conformance + Phase E)*
**Objective:** Close the cheap, high-leverage conformance gaps before more code depends on the current shapes.
**Scope/tasks:**
1. **DR-2** OrderStatus realign (`IN_PRODUCTION`, `QUALITY_CHECK`, `COMPLETED`) + transition map + data migration + history backfill.
2. **DR-4** Auth hardening: `refresh_tokens` table, rotation + httpOnly cookie + reuse-detection; `@nestjs/throttler`; `GET /auth/me`.
3. **DR-5** Add `WORKER` role.
4. **DR-6** `/api/v1` prefix (backend + frontend base URL).
5. Schema delta remainder that later phases need: `audit_logs`, `notifications` (in-app), and switch **`db push` → `prisma migrate`** (baseline migration).
6. **CI**: GitHub Actions — install → lint → typecheck → test → build (backend+frontend) on PR/main (docs 12 §9, 13 §11).
**AC:** all existing e2e still green; register→login→refresh→reuse-detected→logout works; throttler returns 429 (enveloped); `/api/v1/*` serves; CI green on the branch; migration reproducible on a clean DB.
**Risk:** enum migration on existing rows — mitigated by dev-DB re-seed + a mapping migration.

### Phase B — Catalog completeness & Measurements (BR3)
**Depends on:** A.
**Scope:** category tree (`parent_category_id`, depth ≤ 2); `product_images` table + Cloudinary signed upload (doc 09 §10 validation); `search_vector` FTS (`websearch_to_tsquery`, ILIKE fallback); `customer_measurements` + **BR3 enforcement** at cart/checkout; **currency sweep** (every page → `formatLKR`); admin catalog UI gaps (product CRUD, category tree).
**AC:** checkout blocked when a `requires_measurement` item lacks measurements (unit + e2e); search returns relevant seeded items; image upload validates type/size; no `$` anywhere in the UI; measurements persisted as JSONB on the order item.

### Phase C — Payments completion
**Depends on:** A (PROCESSING enum value per DR-1).
**Scope:** Bank transfer (create → bank details → slip upload (Cloudinary) → admin verify `PROCESSING→COMPLETED` via the **same** `confirmOrder` pipeline); customer result pages `/payment/success` + `/payment/cancel` (PayHere return targets — currently 404); manual refund action + audit; **PayHere sandbox live validation** (external — needs the merchant account).
**AC:** all three methods demoable end-to-end; slip validated + rendered in admin; PayHere sandbox card payment demoed via ngrok and recorded; refund writes `audit_logs`.

### Phase D — Inventory admin & reconciliation
**Depends on:** A.
**Scope:** admin inventory UI (adjust with `PURCHASE|ADJUSTMENT|DAMAGE`, movements ledger view, edit minimum level); low-stock notifications (dedup via `low_stock_notified`); `reconcile-inventory` script + CI job.
**AC:** reconciliation passes after a 50-op mixed storm; BR4 unbreakable via *any* endpoint (tests attempt it); every movement traces to an order or an admin.

### Phase E — Production management  *(the biggest un-built MVP module)*
**Depends on:** A (order states + WORKER role), C (real confirmed orders).
**Scope:** `workers.user_id` FK, `production_tasks`; `ProductionTrigger` on order `CONFIRMED` → one `CUTTING` task per production item (D8: `requires_measurement` or uniform/custom); task machine `CUTTING→STITCHING→FINISHING→QUALITY_CHECK` with `PENDING→IN_PROGRESS→DONE`; assignment (BR5); worker portal (`my-tasks`, act only on own tasks); order auto-advance (`IN_PRODUCTION`/`QUALITY_CHECK`/`COMPLETED`) via `transition()` + history.
**AC:** paying a uniform order in sandbox yields visible `CUTTING` tasks; BR5 enforced; worker cannot touch another's task; mixed retail+custom order auto-advances correctly; order status never hand-set (grep for `transition()`).

### Phase F — Order management & customer tracking
**Depends on:** E.
**Scope:** full lifecycle both sides; **customer tracking timeline** rendered from `order_status_history`; customer `PUT /orders/:id/cancel` (release reservation, PENDING-only).
**AC:** order-to-delivery clickable both sides; timeline shows every transition with timestamp; cancel releases stock (movement + history).

### Phase G — Admin dashboard & reports
**Depends on:** C, E (data to aggregate).
**Scope:** metrics (revenue, orders today, low-stock, pending), charts (Recharts), CSV export (doc 02 §3.8, 07 §11.1).
**AC:** dashboard aggregates real data; low-stock count matches inventory; report endpoints paginate; p95 within doc 03 NFR-001 (<2 s API).

### Phase H — AI dual assistant (DR-9)
**Depends on:** real catalog + sales data (so it reasons over non-empty tables).
**Scope:** FastAPI service; **customer** shopping assistant (FTS retrieval → LLM formats → product cards, IDs validated against DB); **owner** BI assistant (≈6 whitelisted analytics tools via function-calling, ≤3 calls, never emits SQL); floating chat widget (doc 10 §5.5/§7); role-gated (doc 09 §8). Latest Claude model.
**AC:** owner Q&A returns tool-grounded insight; customer search never returns a hallucinated/absent product ID; every tool call logged; p95 < 3 s (doc 13 §10).

### Phase I — Hardening & deployment
**Depends on:** all.
**Scope:** Cypress E2E (customer buy flow, admin flow), k6 load (100 concurrent, doc 13 §9); security pass (SQLi/XSS/rate-limit/webhook replay per doc 13 §8); Sentry; deploy — Vercel (web) + Railway/Render Docker (api, ai) + Neon/Supabase (db) + Cloudinary + Upstash (if caching added); env + SSL + backups (doc 12).
**AC:** production URL live; CI/CD deploys on merge; deployment checklist (doc 12 §18) all ticked.

### Phase J — Design-system resolution (DR-3) — parallelizable
Runs per the ratified DR-3 option. If **B**: document tokens + introduce shadcn for new admin components as Phases D–G build them. If **A**: a scheduled migration sprint.

---

## 5. Cross-cutting quality gates

**Definition of Done (every task):** typecheck ✓ · lint ✓ · unit tests ✓ · relevant integration/e2e ✓ · `.env.example` updated ✓ · no `console.log` / unused vars (CODING_STANDARDS §15) ✓ · migration reproducible ✓ · money is `Decimal` end-to-end · stock changes only via the ledger inside a transaction · status changes only via `transition()` + history · secrets only via env · no passwords/tokens/payment payloads in logs.

**Testing strategy (doc 13):** unit (Jest / services + utils); **integration (Supertest)** on endpoints — *currently missing, add from Phase A*; payment security suite (success/fail/duplicate/signature/tampered/replay) — *already met for PayHere, extend to bank*; E2E (Cypress) + load (k6) in Phase I; money-math, stock-math, and state-machines are **always** tested.

**Security baseline (doc 09):** Zero-trust API enforcement (middleware is only a hint; the API is the gate); bcrypt 12; RBAC on every admin/worker route; helmet + CORS-from-env; parameterized queries only (raw `$queryRaw` uses bind params — keep it that way).

---

## 6. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | PayHere sandbox account approval lead-time | blocks live hash validation (Phase C) | **Apply today**; simulator already de-risks server logic |
| R2 | DR-3 shadcn decision deferred | rework + academic-grading risk | Ratify DR-3 with supervisor **before** Phase G UI grows |
| R3 | OrderStatus migration on existing data | data integrity | dev-DB re-seed + explicit mapping migration; do it in Phase A while data is small |
| R4 | Scope vs timeline (AI + production + deploy remain) | MVP slip | risk-front-loaded order; each phase demoable; AI is second-to-last |
| R5 | AI reliability / hallucination | demo failure, doc 09 §8 | function-calling + DB ID validation (DR-9), not text-to-SQL |
| R6 | Frontend has zero automated tests | regressions | add Cypress smoke + component tests from Phase B |

---

## 7. Immediate next actions (the next ~2 weeks)

1. **Ratify DR-3** (shadcn) and **DR-1/DR-2** enum rulings with the supervisor. *(owner)*
2. **Apply for the PayHere sandbox merchant account.** *(owner, external lead-time)*
3. **Execute Phase A** in this order: OrderStatus realign (DR-2) → auth hardening (DR-4) → WORKER role (DR-5) → `/api/v1` (DR-6) → `prisma migrate` baseline → GitHub Actions CI.
4. Then Phase B (measurements/BR3 + currency sweep) — closes the last MVP *customer-flow* gap.

**Guiding principle (Scope §7):** *"If a feature does not directly support order-to-delivery, it is not MVP."* Production → order tracking → dashboard → AI, in that order, because each reasons over data the previous one creates.
