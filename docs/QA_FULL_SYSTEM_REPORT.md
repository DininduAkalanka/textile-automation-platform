# Nandana Textile Platform — Full-System QA, Security & Architecture Audit Report

**Date:** 2026-11-18  
**Audit Lead:** Senior QA Architect & Principal SDET  
**Git Branch:** `qa/full-system-20261118`  
**Repository:** Smart Textile Business Management & E-Commerce Platform with AI Intelligence  
**Coverage Ledger:** [`docs/qa/coverage-ledger.csv`](file:///c:/Users/dinin/OneDrive/Desktop/Nandana%20Textile/Smart-Textile-Business-Management-E-Commerce-Platform-with-AI-Intelligence/docs/qa/coverage-ledger.csv) (207 tracked components)

---

## A. Audit Verdict & Top 5 Business Risks

### Executive Verdict: **DO NOT SHIP (Blocked until P0/P1 remediations land)**

The platform exhibits exemplary architecture in core financial and transactional invariants (single database writer, double-entry inventory ledger with row-level locks, server-calculated totals using `Prisma.Decimal`, strict measurement validation, and defensive AI tool whitelisting). However, several critical vulnerabilities in authentication, access control, credential exposure, and infrastructure pipelines create unacceptable risk in production.

### Top 5 Risks by Business Impact

1. **Plaintext OTP Logging & Parallel Brute-Force Bypass (L-01, L-02) [CRITICAL]**  
   - *Impact:* Customer Account Takeover & Privacy Violation.  
   - *Mechanism:* Every 6-digit OTP code and destination email/phone is logged in plaintext to stdout in all environments including production (`verification.service.ts:79-82`). Concurrently, non-atomic check-then-increment (`verification.service.ts:103-134`) allows parallel brute-force attacks to bypass the 5-attempt lockout limit.

2. **Wildcard Vercel CORS + `SameSite=None` Refresh Cookie (L-03) [CRITICAL]**  
   - *Impact:* Cross-Site Session Hijacking & Unauthorized Account Actions.  
   - *Mechanism:* `main.ts:46-59` allows any origin ending in `.vercel.app` with `credentials: true`. In production, refresh tokens are issued with `sameSite: 'none'` (`auth.controller.ts:51`). Any malicious application deployed on Vercel can make credentialed background requests to refresh tokens and execute actions on behalf of authenticated users.

3. **CI/CD Script Injection via Workflow Inputs (L-13) [HIGH]**  
   - *Impact:* Full Repository & Cloud Secrets Compromise.  
   - *Mechanism:* `.github/workflows/render-keepalive.yml:42-43` interpolates `${{ inputs.custom_backend_url }}` directly into a bash command string inside `run: |`, permitting arbitrary command execution in the GitHub Actions runner context with access to repository secrets.

4. **Production Health Check False-Positive Masking Outages (L-07) [HIGH]**  
   - *Impact:* Undetected Outages & Silent Failures.  
   - *Mechanism:* When PostgreSQL is completely down, `GET /api/v1/health` catches the database exception and returns `{ status: 'degraded', database: 'down' }` with **HTTP 200 OK** (`app.controller.ts:28-44`). Docker, Render, and uptime monitors treat HTTP 200 as healthy, preventing automatic failover, container restart, or alerting while all customer operations fail.

5. **Missing `trust proxy` & In-Memory Rate Limiting (L-04) [HIGH]**  
   - *Impact:* Denial of Service for Legitimate Users & Unenforced Throttling.  
   - *Mechanism:* Express is not configured with `app.set('trust proxy', 1)`. Behind Render/Railway/Cloudflare reverse proxies, all customer requests share the single internal proxy IP address. With in-memory throttler storage and tight limits (20/min on auth), a small burst of requests from one user locks out all customers across the platform.

---

## B. Baseline Verification & Claims vs. Reality

### Baseline Command Execution Table

| Layer | Exact Command | Exit Code | Duration | Outcome / Notes |
|:---|:---|:---:|:---:|:---|
| **Backend Unit** | `npm test` | **0** | 13.44s | **16 / 16 suites passed, 163 / 163 tests passed**. |
| **Backend Build** | `npm run build` | **0** | 10.41s | Clean NestJS TypeScript compilation. |
| **Backend Lint** | `npx eslint "{src,test}/**/*.ts"` | **1 (RED)** | 8.22s | **71 errors, 158 warnings** (Prettier formatting + `@typescript-eslint/no-unsafe-*`). |
| **Frontend Types** | `npx tsc --noEmit` | **0** | 5.72s | Clean TypeScript 5 check, 0 errors. |
| **Frontend Lint** | `npx eslint .` | **0** | 7.91s | 0 errors, 107 warnings (React 19 effect rules). |
| **Frontend Build** | `npx next build --webpack` | **0** | 15.30s | All 35 routes compile and generate static/dynamic pages cleanly. *(Turbopack mode panics on Windows child process IPC; standalone mode encounters OneDrive NTFS EPERM on `.next/standalone`).* |
| **AI Pytest** | `pytest tests` | **1 (RED)** | 0.38s | Host Python 3.14 lacks packages (`asyncpg`, `fastapi`). 42 tests (~47 parametrized cases) designed for Python 3.12 Docker runtime. |
| **Backend Integration** | `npm run test:integration` | **BLOCKED** | - | Local Docker daemon is stopped; requires PostgreSQL 16 container on port 5433. |
| **E2E Cypress** | `npm run test:e2e` | **BLOCKED** | - | Requires active running backend (:3001) + frontend (:3000) with seeded DB. |

### Claims vs. Reality Matrix

| Documentation / README Claim | Audit Ground Truth | Discrepancy / Reality Assessment |
|:---|:---|:---|
| **Automated Tests: 413 Passing (100%)** | 163 Backend Unit + 47 AI (in container) | Integration (169) and Cypress (35) require running Docker stack. Unit test layer passes 100%. |
| **Cypress E2E: 35/35 Passing** | 9 spec files, 35 scenarios defined | Valid test structure present; requires live backend + frontend stack. |
| **k6 Load Tested: 100 VUs \| p95 302ms** | Scenarios in `scripts/load/` | Scripts exist (`scenarios.js`, `webhook-spike.js`); requires live environment to reproduce. |
| **CI Gate: Strict Code Quality** | `continue-on-error: true` in CI | **Discrepancy:** Backend lint gate is completely bypassed in CI due to 71 pre-existing errors. |
| **Single Source of Truth Inventory** | `MovementType` enum (7 types) | **Discrepancy:** README claims `RETURN` and `PRODUCTION_USE` exist; they do not exist in the schema. |
| **Production Kanban Stages** | 4 stages in `production.machine.ts` | **Discrepancy:** README lists `CUTTING -> SEWING -> FINISHING -> QUALITY_CONTROL -> DISPATCHED -> COMPLETED`. Code implements `CUTTING -> STITCHING -> FINISHING -> QUALITY_CHECK`. |
| **Redis 7 Caching & Rate Limiting** | Container defined in `docker-compose.yml` | **Discrepancy:** Redis is 100% unused in backend code (`package.json` lacks Redis clients; Throttler is in-memory). |

---

## C. Coverage Ledger Summary

Full detailed CSV available at [`docs/qa/coverage-ledger.csv`](file:///c:/Users/dinin/OneDrive/Desktop/Nandana%20Textile/Smart-Textile-Business-Management-E-Commerce-Platform-with-AI-Intelligence/docs/qa/coverage-ledger.csv).

| Layer | Total Components | Tested / Covered | Gaps Identified | Coverage % |
|:---|:---:|:---:|:---:|:---:|
| **L1: Backend API & Domain** | 81 | 79 | 2 | 97.5% |
| **L2: Database & Migrations** | 38 | 37 | 1 | 97.4% |
| **L6: Frontend Storefront & Portals** | 37 | 29 | 8 | 78.4% |
| **L7: AI Intelligence Microservice** | 10 | 10 | 0 | 100.0% |
| **L8: External Integrations** | 8 | 8 | 0 | 100.0% |
| **L9: Infrastructure & CI/CD** | 33 | 33 | 0 | 100.0% |
| **Total Platform Inventory** | **207** | **196** | **11** | **94.7%** |

---

## D. Lead Status (L-01 to L-14 & F-01 to F-07)

| Lead | Target Area | Status | Evidence / Quoted Location |
|:---:|:---|:---:|:---|
| **L-01** | Plaintext OTP logging in production | **CONFIRMED** | `backend/src/verification/verification.service.ts:79-82`: `this.logger.log(...)` logs plaintext code and destination regardless of `NODE_ENV`. |
| **L-02** | OTP attempt check-then-increment TOCTOU race | **CONFIRMED** | `backend/src/verification/verification.service.ts:103-134`: Reads attempts, checks `>= MAX_ATTEMPTS`, then increments in separate update. Parallel calls bypass lockout. |
| **L-03** | Permissive `.vercel.app` CORS + SameSite cookie | **CONFIRMED** | `backend/src/main.ts:52`: `origin.endsWith('.vercel.app')` with `credentials: true`. Rejection throws `new Error()` (500). `auth.controller.ts:51` sets `sameSite: 'none'`. |
| **L-04** | Missing `trust proxy` & dead Redis infrastructure | **CONFIRMED** | `backend/src/main.ts` lacks `trust proxy`. `app.module.ts:35` uses in-memory store. Zero `redis` references in `backend/src/`. |
| **L-05** | Swagger exposed by default in production | **CONFIRMED** | `backend/src/main.ts:96`: `if (process.env.SWAGGER_ENABLED !== 'false')` enables Swagger UI unless explicitly disabled. |
| **L-06** | AI service insecure defaults & non-constant compare | **CONFIRMED** | `ai/app/config.py:22-29`: Default keys and DB pass present. `main.py:76` uses `!=` instead of `hmac.compare_digest`. Empty key allows unauthenticated bypass. Real key found in `ai/.env:4`. |
| **L-07** | Health check returns HTTP 200 when DB is down | **CONFIRMED** | `backend/src/app.controller.ts:34-43`: Catches DB error, sets `database = 'down'`, returns `{ status: 'degraded' }` with default HTTP 200 OK. |
| **L-08** | PayHere signature compare & Stripe idempotency | **PARTIALLY REFUTED / CONFIRMED** | PayHere signature comparison uses `timingSafeCompare` (`crypto.timingSafeEqual`) (**REFUTED**). Stripe webhook handler (`payments.service.ts:490-542`) lacks idempotency persistence (**CONFIRMED**). |
| **L-09** | Prior Audit F-01 to F-07 Status Verification | **VERIFIED** | See F-01 to F-07 details below. F-01, F-02, F-07 are FIXED. F-03, F-04, F-05, F-06 remain PRESENT. |
| **L-10** | Uploads on Render ephemeral filesystem | **CONFIRMED** | `backend/src/uploads/uploads.controller.ts:38`: Stores files at `uploads/`. Render Web Services have ephemeral disks; files vanish on redeploy/sleep. |
| **L-11** | Dockerfile runs migrate + seed on every boot | **PARTIALLY REFUTED / CONFIRMED** | `backend/Dockerfile:56` runs `npx prisma migrate deploy` (**CONFIRMED**), but does NOT run `db:seed` (**REFUTED**). |
| **L-12** | Frontend unoptimized images, local IP, render wildcard | **CONFIRMED** | `frontend/next.config.ts:8-32`: `unoptimized: true`, `dangerouslyAllowLocalIP: true`, wildcard `**.onrender.com`, and hardcoded fallback backend URL. |
| **L-13** | Script injection in `render-keepalive.yml` | **CONFIRMED** | `.github/workflows/render-keepalive.yml:42-43`: `${{ inputs.custom_backend_url }}` interpolated directly into bash command. |
| **L-14** | Repo hygiene: junk files, commit history, passwords | **CONFIRMED** | Empty file `git` (0B), `~$OUP_COMMIT_PLAN.html` (162B Word lock), duplicate audit markdown file. Passwords in `docker-compose.yml`. |

### Prior Audit Status (F-01 to F-07)

- **F-01 (Guest checkout refresh token exposure):** **FIXED** (`orders.controller.ts:63-75` strips token from body and sets httpOnly cookie).
- **F-02 (Stale Inventory schema comment):** **FIXED** (`schema.prisma:359-367` reflects accurate single-source-of-truth ledger).
- **F-03 (`npm audit` CVEs - Multer/Sharp/PostCSS):** **CONFIRMED PRESENT** in package dependencies.
- **F-04 (Access token in `localStorage`):** **CONFIRMED PRESENT** (`frontend/src/lib/token-store.ts:13,22`).
- **F-05 (ESLint `continue-on-error: true` in CI):** **CONFIRMED PRESENT** (`.github/workflows/ci.yml:75` with 71 backend errors).
- **F-06 (MIME-only upload validation):** **CONFIRMED PRESENT** (`uploads.controller.ts:44-70` checks `file.mimetype` only, no magic bytes).
- **F-07 (Global deny-by-default auth guard):** **FIXED** (`app.module.ts:63` installs global `JwtAuthGuard`).

---

## E. Consolidated Bug Table

| ID | Layer | Title | Severity | Priority | Status | File:Line | Expected vs Actual | Root Cause | Minimal Fix |
|:---|:---|:---|:---:|:---:|:---:|:---|:---|:---|:---|
| **QA-001** | L3 Auth | Plaintext OTP & Contact Number Logged to Stdout | **CRITICAL** | P0 | CONFIRMED | `backend/src/verification/verification.service.ts:79-82` | **Expected:** OTP never in logs in any environment.<br>**Actual:** Emits plaintext code and phone/email to stdout unconditionally. | `this.logger.log` called outside `NODE_ENV !== 'production'` gate. | Wrap log in `if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP_BYPASS === 'true')` and mask contact. |
| **QA-002** | L3 Auth | Non-Atomic OTP Attempt Increment (TOCTOU Race) | **CRITICAL** | P0 | CONFIRMED | `backend/src/verification/verification.service.ts:103-134` | **Expected:** Lockout strictly after 5 failed guesses.<br>**Actual:** Concurrent requests pass attempt check simultaneously. | Read-then-update without row lock or atomic conditional update. | Use atomic SQL update: `UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1 AND attempts < 5`. |
| **QA-003** | L1 Security | Wildcard CORS Domain & `SameSite=None` Refresh Cookie | **CRITICAL** | P0 | CONFIRMED | `backend/src/main.ts:52`, `backend/src/auth/auth.controller.ts:51` | **Expected:** Strict CORS origin whitelist; SameSite Lax/Strict.<br>**Actual:** Permits `*.vercel.app` with credentials; refresh cookie `SameSite=None`. | Permissive suffix match and overly relaxed cookie cross-site policy. | Restrict CORS to exact `FRONTEND_URL`; change refresh cookie to `sameSite: 'lax'` (or strict cross-domain reverse proxy rewrite). |
| **QA-004** | L9 CI/CD | Script Injection in Keep-Alive Workflow | **HIGH** | P1 | CONFIRMED | `.github/workflows/render-keepalive.yml:42-43` | **Expected:** Safe input parameter handling.<br>**Actual:** `${{ inputs.custom_backend_url }}` evaluated directly in shell script. | GitHub Actions expression interpolation inside bash `run: \|`. | Pass inputs via action step `env:` block, not inline template expression. |
| **QA-005** | L1 Observability | Degradation Masked: Health Check Returns 200 on DB Failure | **HIGH** | P1 | CONFIRMED | `backend/src/app.controller.ts:28-44` | **Expected:** HTTP 503 Service Unavailable when DB is down.<br>**Actual:** Returns HTTP 200 OK with `{ status: 'degraded' }`. | NestJS defaults uncaught return objects to 200 OK. | Throw `ServiceUnavailableException` or inject `@Res()` to set status 503 when `database !== 'up'`. |
| **QA-006** | L7 AI | Insecure AI Auth Defaults & Non-Constant Comparison | **HIGH** | P1 | CONFIRMED | `ai/app/config.py:29`, `ai/app/main.py:76` | **Expected:** Constant-time key comparison; boot failure on default key in prod; reject empty key.<br>**Actual:** Uses `!=`; empty key bypasses auth; boots with dev defaults. | Missing production validation guard and timing-vulnerable string equality. | Use `secrets.compare_digest()`; reject empty strings; validate in lifespan startup. |
| **QA-007** | L1 Infra | Missing `trust proxy` & Dead Redis Infrastructure | **HIGH** | P1 | CONFIRMED | `backend/src/main.ts`, `backend/src/app.module.ts:35` | **Expected:** Client IP resolved from proxy header; shared distributed rate limiter.<br>**Actual:** Express uses socket IP; throttler is in-memory; Redis is dead code. | `app.set('trust proxy', 1)` missing; Redis not wired into NestJS Throttler. | Set `trust proxy` in `main.ts`; wire `@nest-lab/throttler-storage-redis` or document in-memory single-node constraints. |
| **QA-008** | L1 Security | Swagger Documentation Exposed by Default in Production | **MEDIUM** | P2 | CONFIRMED | `backend/src/main.ts:96` | **Expected:** Swagger disabled in production unless explicitly requested.<br>**Actual:** Enabled unless `SWAGGER_ENABLED === 'false'`. | Inverted condition default (`!== 'false'`). | Require explicit opt-in: `if (process.env.SWAGGER_ENABLED === 'true' && process.env.NODE_ENV !== 'production')`. |
| **QA-009** | L6 Security | Unvalidated `returnTo` Open Redirect | **MEDIUM** | P2 | CONFIRMED | `frontend/src/hooks/use-auth.ts:33`, `frontend/src/app/(auth)/verify/page.tsx:93` | **Expected:** Redirect restricted to internal relative paths.<br>**Actual:** `router.push(returnTo)` navigates to external/protocol-relative URLs. | Missing sanity check on redirect target parameter. | Validate: `returnTo.startsWith('/') && !returnTo.startsWith('//')`. |
| **QA-010** | L10 Security | File Upload MIME Validation Without Magic Bytes | **MEDIUM** | P2 | CONFIRMED | `backend/src/uploads/uploads.controller.ts:44-70` | **Expected:** File inspection verifies magic byte signatures.<br>**Actual:** Relies entirely on client-supplied `file.mimetype` header. | Trusting client-supplied header. | Inspect buffer header bytes (0xFF 0xD8 for JPEG, 0x89 0x50 0x4E 0x47 for PNG, RIFF/WEBP). |
| **QA-011** | L9 CI/CD | Broken Lint Gate in CI with 71 Backend Errors | **MEDIUM** | P2 | CONFIRMED | `.github/workflows/ci.yml:75` | **Expected:** Zero lint errors; strict PR gate.<br>**Actual:** `continue-on-error: true` suppresses 71 errors and 158 warnings. | Legacy code-style drift never burned down. | Run `npx eslint --fix` to resolve formatting; clean remaining type assertions; remove `continue-on-error`. |
| **QA-012** | L12 Docs | Documentation Drift: Enum & Stage Mismatches in README | **LOW** | P3 | CONFIRMED | `README.md:49-50` | **Expected:** README exactly reflects code contracts.<br>**Actual:** Lists non-existent `RETURN`, `PRODUCTION_USE`, and incorrect stage names. | Architectural revisions not propagated to README. | Align README with `schema.prisma` and `production.machine.ts`. |

---

## F. Refuted List (Items Verified and Found Sound)

1. **PayHere Webhook MD5 Comparison Timing Attack (L-08 Part 1):**  
   - *Result:* **REFUTED.** `backend/src/payments/payments.service.ts:682` uses `timingSafeCompare(localSig, md5sig.toUpperCase())`, which delegates to `crypto.timingSafeEqual` over fixed-length ASCII buffers (`payhere.util.ts:81-86`).
2. **Dockerfile Running Seed on Boot (L-11 Part 2):**  
   - *Result:* **REFUTED.** `backend/Dockerfile:56` runs `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]`. `npm run db:seed` is **not** executed on container boot.
3. **Guest Checkout Refresh Token Exposure (F-01):**  
   - *Result:* **REFUTED / FIXED.** `backend/src/orders/orders.controller.ts:63-75` strips `refreshToken` from the JSON payload and writes it strictly as an `httpOnly` cookie.
4. **Stale Inventory Ledger Documentation in Schema (F-02):**  
   - *Result:* **REFUTED / FIXED.** `backend/prisma/schema.prisma:359-367` accurately documents the double-entry invariant and reconciliation script contract.
5. **Global Opt-In Auth Guard Gap (F-07):**  
   - *Result:* **REFUTED / FIXED.** `backend/src/app.module.ts:63` provides global `JwtAuthGuard` via `APP_GUARD`, failing closed on all routes without explicit `@Public()` decorator.
6. **Client-Side Price or Total Manipulation:**  
   - *Result:* **REFUTED.** `orders.service.ts:196-223` ignores client prices; unit prices and totals are recomputed from the database using `Prisma.Decimal`.
7. **Production Stage Progression Bypass:**  
   - *Result:* **REFUTED.** All transitions strictly enforce `production.machine.ts:applyAction`. At `QUALITY_CHECK`, tasks cannot be marked done without explicit `qc_pass` or `qc_fail`.
8. **Client Measurement Tampering:**  
   - *Result:* **REFUTED.** Server-side `validateMeasurements` runs in `orders.service.ts:178-194` against the product's catalog type, preventing clients from spoofing bespoke items as ready-made.

---

## G. Performance Results vs. NFRs

- **NFR-001 Benchmark:** Response time < 2000ms at 100 concurrent virtual users.
- **k6 Load Audit Scripts:** Located in `scripts/load/scenarios.js` (100 VU customer shopping journey) and `scripts/load/webhook-spike.js` (burst payment webhook concurrency).
- **Previous Recorded Metrics:** 4,479 requests, 0.00% error rate, p95 = 302.33ms (6.6x faster than requirement).
- **Observation:** In-memory throttler store and un-optimized Next.js images (`images.unoptimized: true`) will degrade p95 and Core Web Vitals under real production distribution. Transitioning to distributed Redis rate-limiting and CDN image optimization is required for true high-load resilience.

---

## H. Critical User Journeys (J1 to J8) Architectural Audit

- **J1: Guest Shopping & Webhook Fulfillment:** Verified sound. Refresh token is stripped; signed PayHere notification reserves/sells stock via double-entry ledger.
- **J2: Registered Customer OTP & Verification:** Code path sound, but vulnerable to QA-001 (log disclosure) and QA-002 (parallel guess TOCTOU).
- **J3: Installment Plans:** Implemented via `createInstallmentPayment`. Precision uses cents math; last installment absorbs rounding remainder.
- **J4: Admin Catalog & Inventory:** Row-level locks (`SELECT FOR UPDATE`) protect stock adjustments. Product deletion correctly differentiates soft-archive from hard-delete (`deletion-check`).
- **J5: Worker Production Pipeline:** State machine guarantees QC failure returns order to `IN_PRODUCTION` and task to `FINISHING/PENDING`.
- **J6: AI Shopping & BI:** Customer chat strictly grounded via `grounding.py` and DB lookups. Executive tools are whitelisted with Pydantic schema validation; model cannot write arbitrary SQL.
- **J7: Cancellation & Stock Release:** Cancelling an order generates signed `RELEASE` movements in `InventoryMovement`, maintaining ledger balance.
- **J8: Session Lifecycle & Rotation:** Refresh token rotation is implemented in `auth.service.ts`. Vulnerable to QA-003 due to CORS `.vercel.app` wildcard and `SameSite=None`.

---

## I. Areas Not Verified in Local Environment (And Why)

1. **PostgreSQL Real Concurrency Integration Tests (`backend/test/*.e2e-spec.ts`):**  
   - *Reason:* Docker Desktop daemon is not running on the local host machine, and no local PostgreSQL 16 service is active on port 5432 or 5433.
2. **Cypress Headless E2E Browser Automation (`frontend/cypress/e2e/*.cy.ts`):**  
   - *Reason:* Requires running backend (:3001) and frontend (:3000) against an initialized and seeded PostgreSQL database.
3. **AI Python Integration Suite (`ai/tests/*.py`):**  
   - *Reason:* Host Python runtime is 3.14.6 without compiled Windows wheels for `asyncpg`. Tests are designed to run inside the `python:3.12-slim` Docker container.
4. **Third-Party External Webhooks (Live PayHere & Meta Graph API):**  
   - *Reason:* Live payment and social provider APIs were intentionally not called, in strict accordance with operating safety rules (mock/sandbox only).

---

## J. Questions for the System Owner

1. **CORS & Domain Whitelisting:** What is the exact production custom domain for the frontend storefront (e.g., `https://nandanatextile.lk`)? Can we immediately remove the `.endsWith('.vercel.app')` wildcard and restrict CORS to exact production and staging origins?
2. **Persistent Storage for Uploads:** What external cloud storage provider (e.g., Cloudinary, AWS S3, or Supabase Storage) should be used for product images to eliminate data loss on Render's ephemeral filesystem?
3. **Redis Deployment:** Is a managed Redis instance (e.g., Upstash or Render Redis) available in production to replace the in-memory throttler store, or should we configure `trust proxy` for single-instance in-memory rate limiting?
4. **Groq Model Selection:** The committed `LLM_MODEL` in `.env.example` is `llama-3.3-70b-versatile`, whereas README mentions `openai/gpt-oss-120b`. Should `llama-3.3-70b-versatile` remain the designated production standard?
