# Independent Engineering Audit — Textile Automation Platform
**Repository:** github.com/DininduAkalanka/textile-automation-platform (main, cloned for this audit)
**Stack observed:** NestJS 11 + Prisma 6 + PostgreSQL (backend) · Next.js/React 19 (frontend) · FastAPI/Python (AI service) · Docker Compose

### Scope note (read this first)
This is a large monorepo (backend ~888K of `src`, frontend ~1.4M of `src`, plus a Python AI service, ~20 Prisma models, 11 migrations, 30+ test files, and a repo-authored 20-document requirements/architecture set in `/docs`). A single pass cannot line-by-line verify every file. I inspected the system depth-first through its highest-risk, highest-blast-radius paths — **auth, authorization, orders, inventory concurrency, payments/webhooks, file uploads, dependency security, CI/CD** — and breadth-first through the rest (module list, schema, docs, scripts). Findings below are graded FACT / INFERENCE / ASSUMPTION per the requested methodology; I did not fabricate coverage numbers, performance numbers, or vulnerabilities I couldn't verify. Areas I did **not** deeply verify (frontend component-level a11y/render-perf, `notifications`/`sms`/`social` module internals, the full AI evaluation harness, every one of the 11 migrations) are flagged as **Unable to verify from repository evidence** rather than scored.

---

## 1. Executive Summary

This is a materially more mature codebase than the "student/portfolio textile ordering app" the name suggests. It shows clear evidence of iterative hardening driven by a real design-and-decisions process (`docs/00`–`13`, an `IMPLEMENTATION_PLAN.md`, and in-code comments that reference specific plan sessions and prior bugs, e.g. *"a client self-reporting 'I paid' was previously reachable... removed here because nothing verified it actually happened"*). That is a strong positive signal: the team is finding and closing real vulnerabilities, not just shipping features.

**Strongest parts:**
- Race-safe inventory reservation using a guarded, conditional raw `UPDATE ... WHERE available - reserved >= qty RETURNING id` inside the caller's transaction — the correct pattern for preventing overselling, and it's exercised by a dedicated CI step (`test/stock-race.e2e-spec.ts`) and a reconciliation auditor run in CI.
- Payment security model is close to textbook: no client-facing "mark my own payment paid" endpoint exists (and the code contains a comment recording that this exact vulnerability existed earlier and was deliberately removed); Stripe webhook uses signature verification (`stripe.webhooks.constructEvent`); PayHere webhook is idempotent via a unique DB constraint on `(gateway, transactionId, eventStatus)` and verifies an HMAC-style signature before touching state.
- Auth: bcrypt cost 12, JWT secret validated at boot (`class-validator`, min 32 chars, process exits rather than booting insecurely), refresh-token rotation with **reuse detection** (presenting an already-revoked refresh token revokes the entire session family) — a genuinely above-average implementation for a project this size.
- Authorization is not blanket/global but enforced per-route with explicit ownership checks (e.g., `orders.findById` takes `{isAdmin} | {userId}` and the controller decides which based on `req.user.role`) — reviewable and mostly correct, see findings below for the one gap found.

**Biggest risks (see Section 5/6 for full detail):**
- 🟠 **Dual/legacy stock-tracking documentation vs. implementation drift**: `schema.prisma` still contains a comment claiming the `inventory` ledger is "additive" and that services "still use `products.stock_quantity`," while `inventory.service.ts`'s own header comment says the opposite (ledger is authoritative, `stock_quantity` is now a denormalized cache updated in the same transaction). The code is fine; the schema comment is stale and could mislead a future engineer into reintroducing the exact bug that was already fixed.
- 🟠 **Guest checkout issues the raw refresh token in the JSON response body**, unlike `/auth/login` and `/auth/register`, which set it only as an `httpOnly` cookie and strip it from the body. This is an inconsistent trust boundary: the guest-checkout refresh token is exposed to any script running on the page (XSS blast radius), and functionally it also means guest sessions likely can't silently refresh (no cookie is set), so guests are silently logged out ~15 minutes after checkout.
- 🟠 **Confirmed high-severity transitive dependency vulnerabilities**: `multer` (DoS via deeply-nested field names / incomplete upload cleanup, GHSA-72gw-mp4g-v24j, GHSA-3p4h-7m6x-2hcm) via `@nestjs/platform-express`, and on the frontend, `sharp`/libvips CVEs and a PostCSS source-map path-traversal advisory, all confirmed via `npm audit` against the committed lockfiles.
- 🟡 Frontend stores the **access token in `localStorage`** (confirmed in `services/http.ts`, `store/useAuthStore.ts`, `lib/api.ts`) rather than an in-memory value; short 15-minute TTL and the fact that the refresh token is correctly `httpOnly` for the primary auth flows meaningfully limits — but does not eliminate — the XSS blast radius.
- 🟡 Lint is `continue-on-error: true` in CI with an acknowledged 129 pre-existing lint errors (comment in `ci.yml` itself) — this is honest but means CI cannot currently catch new lint regressions, only build/test failures.
- 🟡 File upload validation is MIME-type + extension based only; there's no magic-byte/content sniffing, so a spoofed `Content-Type` header can bypass the filter (mitigated significantly by forced-safe-extension renaming and static-file serving, so exploitability is low, not zero).

**Production readiness:** ⚠️ **Conditionally production-ready.** The core money-and-inventory path (place order → reserve stock → pay → confirm → fulfil) is the best-engineered part of the system and shows real defense-in-depth. The risk surface that remains is concentrated in a small number of fixable items (dependency patching, the guest-checkout token leak, and stale documentation) rather than systemic architectural rot. See Section 18 for the exact conditions.

---

## 2. Overall Engineering Score

Scored only where I gathered direct evidence; anything scored is annotated with the confidence behind it.

| Category | Score /10 | Basis |
|---|---:|---|
| Architecture | 7 | Clean NestJS module boundaries (auth/orders/payments/inventory/production/ai/etc.), Prisma as a single ORM boundary, FastAPI AI service kept as a separate process behind a provider-agnostic `LlmClient` interface. Some cross-cutting concerns (verification gating, idempotent order confirmation) are shared correctly rather than duplicated. |
| Backend | 7.5 | Ownership-checked routes, transactional order creation, race-safe inventory, signature-verified webhooks. Docked for the guest-checkout token-exposure inconsistency and reliance on `continue-on-error` lint. |
| Frontend | 5.5 (partial evidence) | Confirmed: JWT access token in `localStorage`; guest-checkout flow doesn't set an httpOnly cookie. Component-level architecture, accessibility, and render-performance were **not** deeply audited — score reflects security evidence only, not a full frontend review. |
| Database | 7.5 | Good indexing on hot paths (`Order.userId/status/orderNumber/createdAt`), correct `onDelete: Restrict` used deliberately (with an explanatory comment) to prevent silently orphaning inventory-movement audit trail, decimal types for money, unique constraints on financial identifiers (`transactionId`, `orderNumber`). Docked for the stale schema comment describing an already-superseded design. |
| Security | 6 | Strong auth/payment design; confirmed high-severity dependency CVEs unpatched at the audit commit; one real access-token exposure inconsistency; MIME-only upload validation. |
| AI/ML | 6.5 (partial evidence) | Provider-agnostic client, explicit timeouts, no key/raw-error leakage to callers, JSON-repair fallback for non-conforming model output, and an explicit "degrade gracefully, never throw the caller into a 500" design (`build_client` returns `None` when unconfigured). Prompt-injection handling, evaluation harness, and cost controls were **not** verified in depth — `Unable to verify from repository evidence` for those specifics. |
| Testing | 6.5 | 16 backend unit spec files, 9 backend e2e/integration specs (including a dedicated real-Postgres stock-race test — a genuinely rare and valuable test for this domain), 5 Cypress e2e specs. Coverage breadth beyond the inventory/order/payment core was **not** verified. |
| Performance | Not scored | No load-test results, APM data, or profiling artifacts were found in-repo to substantiate a number; `scripts/load` exists but I did not execute it. |
| Scalability | Not scored | Same reason — architectural scalability is discussed qualitatively in Section 13. |
| Reliability | 7 | Idempotent order confirmation (explicitly commented as such and reused across Stripe/PayHere/COD/admin paths), webhook event persistence-before-processing, refresh-token reuse detection. |
| DevOps | 6.5 | Real CI (Postgres service container, migration-deploy dry run, seed, integration tests, reconciliation script) — better than typical. No CD/deployment pipeline was found; `continue-on-error` lint gate is an honest but real gap. |
| Observability | Not scored (low evidence) | `Logger` usage exists throughout (Nest's built-in logger); no APM, structured log aggregation, metrics, tracing, or alerting configuration was found in-repo. |
| Code Quality | 7.5 | Comments consistently explain *why*, not just *what* — including documenting past bugs and the reasoning for schema choices (`onDelete: Restrict` comment is a good example of this). This is unusually good practice for a project this size. |
| Documentation | 8 | 14 numbered design docs plus a security review, QA/E2E+performance report, and a runbook already exist in `/docs`. This is well above typical for a project of this scope. |

---

## 3. Production Readiness Assessment

**⚠️ Conditionally production-ready.**

The transactional core (checkout → stock reservation → payment confirmation → fulfilment) is implemented with the discipline expected of a production financial system: guarded atomic updates, idempotency, signature verification, and an audit trail that cannot be silently orphaned. That is the hard 20% of a system like this, and it's done well.

What stands between this and an unconditional "yes" is narrow and concrete, not systemic: patch two sets of confirmed high-severity transitive dependencies, close the guest-checkout token-exposure inconsistency, resolve (or explicitly re-triage) the 129 pre-existing lint errors currently masked by `continue-on-error`, and get independent verification of the areas this audit could not reach in depth (frontend a11y/perf, AI-service prompt-injection/cost controls, full test coverage of `notifications`/`sms`/`social`).

---

## 4. Architecture Assessment

**Current architecture (as observed):**
```
Customer / Admin (Next.js 19 frontend)
        │  JWT (access: header/localStorage, refresh: httpOnly cookie)
        ▼
NestJS API (modular: auth, orders, payments, inventory, production,
            products, analytics, notifications, uploads, reviews, social)
        │  Prisma ORM, per-route guards (JwtAuthGuard/RolesGuard), $transaction
        ▼
PostgreSQL (order/payment/inventory ledger, audit trail via InventoryMovement)
        │
        ├── FastAPI AI microservice (chat/forecasting/grounding/retrieval,
        │    provider-agnostic LLM client: Anthropic or OpenAI-compatible)
        ├── Stripe / PayHere (payment gateways, webhook-verified)
        └── Resend (email), SMS provider (module present, not deeply audited)
```

**Strengths:** clear module boundaries; the AI service is a separate deployable, not entangled into the Node process; the payment/inventory domain uses the correct concurrency primitive (conditional UPDATE, not optimistic-lock-and-hope or a naive read-then-write); business rules (e.g., "custom/uniform products require measurements") are validated server-side against the product record, not client-asserted data — this specifically defeats a request-tampering bypass.

**Weaknesses / risks:**
- The `RolesGuard`/`JwtAuthGuard` pair is applied per-route rather than globally (only `ThrottlerGuard` is global in `app.module.ts`). This is a legitimate design choice (explicit is safer than "forgot to add `@Public()`"), but it does mean a newly added controller method that forgets `@UseGuards(JwtAuthGuard)` fails open rather than closed. I did not find such an omission in the modules I reviewed (orders, payments), but this is a pattern worth a repo-wide grep/lint rule rather than manual vigilance, given the module count (14+ feature modules).
- No API gateway/versioning strategy beyond a path prefix was observed; not a blocker at current scale.
- Two-source-of-truth stock tracking (`Inventory` ledger vs. `Product.stockQuantity` cache) is architecturally sound *as implemented* (the cache is updated inside the same transaction as the ledger), but the stale schema-level comment describing an earlier, less-safe design is a real documentation hazard — see Finding F-02.

**Recommended architecture improvements:** add an explicit `@Public()` decorator + a global `JwtAuthGuard` default (deny-by-default) rather than opt-in-by-route, specifically because the module count will keep growing; this is a small, high-leverage change, not a rewrite.

---

## 5. Critical Findings

| ID | Severity | Area | Finding | Impact | Priority |
|----|----------|------|---------|--------|----------|
| F-01 | 🟠 HIGH | Security / Auth | Guest checkout returns the raw refresh token in the JSON response body instead of setting it as an `httpOnly` cookie (inconsistent with `/auth/login`, `/auth/register`) | Refresh token exposed to any XSS on the page; guest sessions likely can't silently refresh | P1 |
| F-02 | 🟡 MEDIUM | Database / Documentation | `schema.prisma` comment on the `Inventory` model describes a superseded design ("additive... services still use stock_quantity") that contradicts `inventory.service.ts`'s actual (correct) implementation | Misleads future maintainers into reintroducing a previously-fixed bug | P2 |
| F-03 | 🟠 HIGH | Dependencies | Confirmed `npm audit` high-severity CVEs: `multer` (DoS, 2 advisories) via `@nestjs/platform-express` in backend; `sharp`/libvips and PostCSS source-map path traversal in frontend | DoS risk on the upload endpoint; potential arbitrary `.map` file disclosure in frontend build tooling | P1 |
| F-04 | 🟡 MEDIUM | Frontend Security | JWT access token stored in `localStorage` (confirmed in 3 files) rather than in-memory | Any successful XSS can exfiltrate the live access token; partially mitigated by 15-min TTL | P2 |
| F-05 | 🟡 MEDIUM | DevOps/CI | ESLint step runs with `continue-on-error: true`; repo has an acknowledged 129 pre-existing lint errors (per the CI file's own comment) | New lint regressions are not gated; latent code-quality issues untracked | P2 |
| F-06 | 🔵 LOW | Security | File-upload MIME check trusts the client-supplied `Content-Type` header; no magic-byte verification | Low-severity content-spoofing risk; mitigated by forced safe extension + static serving, not eliminated | P3 |
| F-07 | ⚪ INFO | Architecture | Authorization guards are opt-in per route rather than deny-by-default globally | No exploit found in reviewed modules; architectural risk for future modules that omit the guard | P2 |

---

## 6. Security Findings

1. **F-01 (HIGH) — Guest-checkout refresh-token exposure.** `OrdersController.guestCheckout` (`backend/src/orders/orders.controller.ts`) has no `@Res({ passthrough: true })` and does not call the same `setRefreshCookie()` helper `AuthController` uses; it returns the service result verbatim, and `OrdersService.guestCheckout` → `AuthService.provisionOrFindGuestUser` → `issueSession` returns `{ user, accessToken, refreshToken }` as plain JSON (confirmed against the frontend's own type declaration for this call in `frontend/src/lib/api.ts`, which types the response as including `session.refreshToken`). **Recommended fix:** route guest checkout through the same `setRefreshCookie()` path used by `register`/`login`, and strip `refreshToken` from the JSON body, exactly as those two endpoints already do. Small, low-risk, well-precedented fix (Effort: Small, Confidence: High).

2. **F-03 (HIGH) — Dependency vulnerabilities.** Verified directly by running `npm audit --omit=dev` against the committed lockfiles in this clone:
   - Backend: `multer` 1.0.0–2.1.1 (bundled transitively via `@nestjs/platform-express`) — two high-severity DoS advisories (GHSA-72gw-mp4g-v24j, GHSA-3p4h-7m6x-2hcm). The `uploads` module actively uses `multer`'s `diskStorage`, so this is a live code path, not dead weight.
   - Frontend: `sharp`/libvips high-severity CVEs and a PostCSS incomplete-fix path-traversal advisory (both flagged as requiring `npm audit fix --force`, i.e., a semver-major bump — needs a deliberate upgrade, not a blind auto-fix).
   **Recommended fix:** patch `@nestjs/platform-express`/`multer` to a fixed line; evaluate the frontend `--force` upgrades in a branch with the existing Cypress suite as a regression gate before merging (Effort: Medium, Confidence: High — versions and advisories directly observed, not inferred).

3. **F-04 (MEDIUM) — Access token in `localStorage`.** Confirmed in `frontend/src/services/http.ts`, `frontend/src/store/useAuthStore.ts`, and `frontend/src/lib/api.ts`. This is a common and often-accepted tradeoff (it avoids CSRF concerns that come with cookie-based access tokens), and the system's 15-minute access-token TTL plus properly `httpOnly` refresh cookies for the primary flows meaningfully bounds the damage — but it is still the more XSS-exposed of the two standard patterns. No XSS vector was found in this review to pair with it (a full frontend XSS review — unsafe `dangerouslySetInnerHTML` usage, etc. — was not performed; flagged as **Unable to verify from repository evidence**).

4. **Secrets hygiene:** no live API keys, private keys, or AWS-style credentials were found committed to source (`grep` scan for common secret patterns across `.ts`/`.py`/`.env*`/`.yml` returned no matches). `docker-compose.yml` contains an obviously-labelled local dev DB password and mock Stripe keys (`sk_test_mock`), consistent with development use, not a leak.

5. **Webhook security is a genuine strength:** Stripe uses `stripe.webhooks.constructEvent` (rejects unsigned/forged payloads with a `BadRequestException`, never processes on failure); PayHere verifies a computed HMAC-style signature against the vendor's, persists the raw event *before* taking any action (comment: "1. Persist the raw event first (idempotency + audit)"), and relies on a unique DB constraint to make replay a no-op. I did not find a timing-safe comparison (`crypto.timingSafeEqual`) for the PayHere signature check (it's a plain `===` string comparison) — a low-severity theoretical timing side-channel on an MD5-derived signature, worth a small hardening pass but not a priority item.

---

## 7. Bugs & Functional Problems

**Confirmed bugs:**
- F-01 above is a confirmed inconsistency, verified against both the backend controller and the frontend's own type contract for the same endpoint.

**Likely bugs (strong inference, not fully traced end-to-end):**
- Because guest checkout doesn't set the refresh cookie, guest users almost certainly cannot silently refresh their session and will be force-logged-out ~15 minutes after completing checkout unless they explicitly log in again. This is an inference from the code path, not something I reproduced against a running instance.

**Documentation/code drift (not a runtime bug, but will cause a bug if trusted):**
- F-02: the `schema.prisma` comment describing the inventory model as "additive" is contradicted by `inventory.service.ts`. A developer trusting the schema comment over the service's own (correct, more detailed) header comment could reintroduce the exact double-bookkeeping bug the team already fixed once (per the reconciliation-script comment history in the same file).

**Potential edge-case bugs (flagged for testing, not confirmed):**
- `handleWebhook`'s Stripe path does not appear to persist a Stripe-side idempotency record analogous to PayHere's `paymentWebhookEvent` table before calling `confirmPayment`/`confirmInstallment` — it instead relies entirely on those methods being idempotent. That is very likely fine (the code explicitly labels `confirmOrder`/`confirmPayment` as idempotent, and I found no counter-evidence), but it's an asymmetry with the PayHere path's belt-and-suspenders design worth a targeted test if one doesn't already exist among the 9 e2e specs (I did not open every e2e spec file to confirm this specific case is covered).

---

## 8. Performance Findings

No load-test results, APM traces, or profiler output exist in-repo to substantiate concrete numbers, so this section is qualitative:
- The inventory reservation path uses a single guarded raw `UPDATE ... RETURNING`, which is the right shape for high-contention correctness *and* performance (one round trip, no read-then-write race window, no application-level locking).
- `scripts/load/` exists (load-testing scripts), suggesting the team already has a load-testing habit; I did not execute it, so I cannot report a number — **Unable to verify from repository evidence.**
- Standard N+1 risks were not specifically hunted for in the `products`/`analytics` list endpoints; this is a reasonable next audit target given they weren't in the highest-risk (money/security) path this pass prioritized.

---

## 9. Database Assessment

- **Schema quality:** good — proper `Decimal(10,2)` for money, UUID primary keys, sensible indexes on the hottest query paths (`Order.userId`, `.status`, `.orderNumber`, `.createdAt`; similarly on `Payment`, `Installment`, `InventoryMovement`).
- **Integrity:** `onDelete: Restrict` is used deliberately on `InventoryMovement.order` specifically to prevent Prisma's default `SetNull` behavior from silently orphaning the audit trail — and the comment explains this was caught by the reconciliation script in dev, i.e., this is a documented example of the team catching and fixing a real data-integrity bug rather than a hypothetical one.
- **Migrations:** 11 migrations present; CI applies them to a clean database (`prisma migrate deploy`) specifically to catch the "works on one laptop" class of failure — a real production-safety practice, not just theater, since the CI comment explicitly notes `prisma/migrations` was previously gitignored and this exact gap caused silent failures.
- **Risk:** F-02 documentation drift, as above. I did not audit all 11 migrations individually for destructive operations (e.g., column drops without a backfill step) — **Unable to verify from repository evidence** beyond the two ledger-related models inspected.

---

## 10. AI/ML Assessment

*(Included because the repo has a dedicated FastAPI AI service — `ai/app/`.)*

- **Architecture:** provider-agnostic `LlmClient` abstract base with `AnthropicClient` and `OpenAiClient` (OpenAI-compatible: Groq/OpenAI/OpenRouter/Gemini) implementations selected by config — a clean, swap-without-code-change design.
- **Reliability:** explicit per-request timeout (`llm_timeout_seconds`), `httpx.HTTPError` is caught and re-raised as a domain-specific `LlmError` that never leaks the raw provider error or the API key to callers, and malformed response shapes (`KeyError`/`IndexError`) are caught and converted rather than propagating a raw stack trace. `build_client()` returns `None` when unconfigured so the pipeline can degrade gracefully rather than crash — this is exactly the "what happens when the AI fails" discipline the audit brief asks for.
- **Malformed-output handling:** `parse_json_object()` attempts a strict JSON parse first, then falls back to extracting the outermost `{...}` block via regex — a pragmatic, commonly-used mitigation for models that wrap JSON in prose or code fences.
- **Not verified in this pass** (flagged rather than guessed): prompt-injection defenses specific to any RAG/retrieval content (`retrieval.py`, `grounding.py` exist but weren't read in full), token-usage/cost monitoring, an evaluation/regression harness for model outputs, and confidence scoring/fallback thresholds for the forecasting module (`forecasting.py`, using `statsmodels`). **Unable to verify from repository evidence** — recommend a dedicated follow-up pass scoped specifically to `ai/app/` and `ai/tests/`.

---

## 11. QA & Testing Assessment

**What exists (counted directly):**
- 16 backend unit spec files (`*.spec.ts`)
- 9 backend integration/e2e spec files (`test/*.e2e-spec.ts`), including a dedicated `stock-race.e2e-spec.ts` run against a **real** Postgres service container in CI specifically to prove the oversell guard under concurrent transactions — this is a materially above-average test to have, because it tests a property (row-level locking behavior) that cannot be faked with a mocked ORM.
- 5 Cypress e2e spec files (`frontend/cypress`)
- A CI-run reconciliation script that audits the *entire seeded database's* ledger arithmetic (`available = Σ movements`, `reserved = Σ movements`) as a whole-system sanity check, distinct from and additional to the in-suite reconciliation check.
- Python AI service has its own `pytest.ini` and a `tests/` directory (32K) — not opened in depth this pass.

**Gaps (inferred from what's *not* present, stated as inference not fact):**
- No dedicated security test suite (authz/IDOR fuzzing, SQLi/XSS payload tests) was found as a distinct category — the ownership checks appear correct by code review, but there is no automated regression test I found that specifically tries "User A fetches User B's order by ID" and asserts a 403/404. Given `orders.findById` is the exact place this matters, this is the single highest-value missing test in the reviewed surface.
- No AI-output evaluation/regression tests were found (distinct from the general Python `tests/` dir, whose specific contents weren't enumerated).

**Recommended test pyramid, adapted to what's already strong here:**
```text
                 E2E (Cypress) — expand: guest-checkout token flow, IDOR probes
                /                \
        Integration (Jest, real PG) — already strong on inventory/payments
           /                    \
      Unit Tests (Jest, mocked)   AI eval tests (pytest, currently unclear depth)
```

---

## 12. DevOps & Production Infrastructure

- **CI (`ci.yml`):** genuinely production-grade for its size — real Postgres service container, `prisma migrate deploy` against a clean DB (not just `db push`), a seed step that doubles as a regression check ("the seed has already shipped two real bugs" per the file's own comment — evidence of a team that documents and learns from incidents), integration tests, and a whole-database reconciliation audit as a distinct CI step.
- **Gap:** `Lint: continue-on-error: true` with 129 acknowledged pre-existing errors (F-05). This is honestly disclosed in the CI file itself rather than hidden, which is a good sign about the team's culture, but it is a real gate gap today.
- **No CD/deployment pipeline** was found (no `deploy.yml`, no reference to a hosting target's deploy action). `Dockerfile`s exist for backend, frontend, and the AI service, and `docker-compose.yml` covers local dev — deployment itself appears to be manual or handled outside this repository. **Unable to verify from repository evidence** whether a separate deployment pipeline exists elsewhere.
- **Secrets:** environment validation fails fast at boot on a missing/weak `JWT_SECRET` (`class-validator`, `MinLength(32)`) — a specifically-called-out fix for a previous "boot happily with an empty secret" bug, per the file's own comment. This is a good practice correctly implemented.

---

## 13. Technical Debt

**High:**
- F-03 dependency CVEs (multer, sharp/libvips, PostCSS) — concrete, dated, actionable.
- F-05 lint gate disabled — 129 known errors, untracked drift risk.

**Medium:**
- F-02 stale schema documentation describing a superseded (less safe) design.
- F-01 guest-checkout auth inconsistency.

**Low:**
- F-06 MIME-only upload validation.
- No timing-safe comparison on the PayHere signature check.

**Not yet assessed (flag, not a debt claim):** frontend component reuse/duplication, accessibility, bundle size, and the depth of the `notifications`/`sms`/`social` modules — genuinely out of this pass's scope, not judged either way.

---

## 14. Quick Wins

1. Route `guestCheckout` through the existing `setRefreshCookie()` helper and strip `refreshToken` from its JSON response — the fix pattern already exists verbatim two files away in `AuthController`. (Fixes F-01.)
2. `npm audit fix` for the backend `multer` chain (check whether a non-major fix is available; if only `--force` resolves it, branch + run the existing e2e suite as the regression gate). (Fixes F-03, backend half.)
3. Update the `Inventory` model's schema comment to match `inventory.service.ts`'s actual (correct) design — a five-minute fix that removes a real "reintroduce the old bug" hazard. (Fixes F-02.)
4. Add `crypto.timingSafeEqual` (length-padded) to the PayHere signature comparison — small, cheap hardening.

---

## 15. Priority Remediation Roadmap

**P0 — Immediate (before production):** none of the confirmed findings rise to "must block launch entirely" — the core transactional integrity is sound. Treat F-01 and F-03 as P0-adjacent if the guest-checkout flow and file uploads are both live/customer-facing at launch.

**P1 — Before production:**
- F-01 guest-checkout refresh-token exposure.
- F-03 dependency patching (multer at minimum; evaluate the frontend major bumps with the Cypress suite as a gate).

**P2 — Early production:**
- F-02 documentation correction.
- F-04 evaluate moving the access token to in-memory storage (accepting the added complexity of re-hydrating it via a silent refresh call on app load).
- F-05 burn down the 129 lint errors (or explicitly triage/suppress the ones that are false positives) and remove `continue-on-error`.
- F-07 move to a deny-by-default global auth guard with an explicit `@Public()` opt-out.

**P3 — Long-term:**
- Add authorization-focused (IDOR) regression tests as a first-class CI category.
- Independently audit the AI service's prompt-injection surface, cost controls, and evaluation harness (out of scope here).
- Independently audit frontend accessibility/performance/bundle size (out of scope here).
- Establish an actual CD pipeline if one doesn't already exist outside this repo.

---

## 16. Recommended Testing Roadmap

```text
Phase 1 → Close the IDOR gap: automated test asserting cross-user 403/404 on
          GET /orders/:id, GET /orders/:id/invoice.pdf, GET /payments/:orderId
Phase 2 → Guest-checkout regression test: assert refresh_token cookie is set
          and absent from the JSON body, matching /auth/login's contract
Phase 3 → Dependency-upgrade regression pass using the existing Cypress suite
          as the safety net for the frontend --force upgrades
Phase 4 → AI service: add an evaluation harness for malformed/adversarial model
          output beyond the existing JSON-repair fallback (if not already present
          in ai/tests/ — not fully enumerated this pass)
Phase 5 → Re-enable the lint CI gate once the 129 pre-existing errors are triaged
```

---

## 17. Recommended Production Architecture

No architectural rewrite is justified by the evidence gathered. The one structural change worth recommending is the deny-by-default auth guard (Section 4) — a configuration change, not a rewrite, with low migration difficulty (add `APP_GUARD` for `JwtAuthGuard`, add `@Public()` to the handful of intentionally-open routes like `guest-checkout`, `payhere/notify`, `webhook`, and health checks) and low risk (the existing e2e suite would immediately surface any route that broke).

---

## 18. CTO Decision

**CONDITIONALLY YES.**

Conditions before production launch:
1. Fix F-01 (guest-checkout token exposure) — small, well-precedented fix.
2. Patch or mitigate F-03 (confirmed multer DoS CVEs) on any environment that accepts uploads from untrusted users.
3. Correct F-02's misleading schema comment before onboarding any new engineer to the inventory code.
4. Get an explicit answer on deployment/CD (Section 12) — this audit could not confirm one exists.
5. If time allows before launch, add the IDOR regression tests in Section 16 Phase 1 — the ownership logic reviewed here looks correct, but "looks correct on manual review" and "has an automated regression test" are not the same guarantee for a payment-bearing system.

None of these require re-architecture or a multi-week delay; they are patch-and-verify items.

---

## 19. Top 10 Actions

```text
1.  Fix guest-checkout refresh-token exposure (F-01)         | P1 | Closes an XSS-adjacent auth gap with a fix pattern that already exists in the codebase
2.  Patch multer/@nestjs-platform-express CVEs (F-03)        | P1 | Removes a confirmed, exploitable DoS vector on the upload endpoint
3.  Evaluate + apply frontend sharp/PostCSS CVE fixes (F-03) | P1 | Removes confirmed high-severity build/runtime CVEs
4.  Correct the stale Inventory schema comment (F-02)        | P2 | Prevents a previously-fixed bug from being reintroduced by a future engineer
5.  Add IDOR regression tests for orders/payments endpoints  | P2 | Converts "looks correct on review" into an enforced guarantee
6.  Move to deny-by-default global auth guard (F-07)         | P2 | Removes reliance on every future route remembering @UseGuards
7.  Burn down the 129 lint errors, remove continue-on-error  | P2 | Restores lint as an actual CI gate, not a formality
8.  Evaluate localStorage → in-memory access-token storage   | P2 | Reduces XSS blast radius on the access token
9.  Confirm/establish a CD pipeline (not found in this repo) | P2 | Closes an unverified gap between "CI passes" and "it's deployed"
10. Scope a dedicated AI-service audit (prompt injection,    | P3 | This pass verified reliability/degradation patterns but not
    cost controls, eval harness)                             |    | adversarial-input or cost-runaway scenarios
```

---

## Appendix: What was directly verified vs. inferred vs. out of scope

**Directly verified (FACT):** JWT secret boot validation; bcrypt cost 12; refresh-token rotation + reuse detection; per-route ownership checks in `orders.controller.ts`/`payments.controller.ts`; race-safe raw-SQL inventory reservation; Stripe/PayHere webhook signature verification and PayHere event-idempotency constraint; guest-checkout token-exposure inconsistency (cross-checked against the frontend's own type contract); `npm audit` results against both lockfiles as committed; CI workflow contents including the lint `continue-on-error` and its stated reason; upload MIME/extension/size validation; absence of committed live secrets matching common patterns.

**Inference (strongly evidenced, not runtime-reproduced):** guest users likely lose their session ~15 minutes after checkout due to the missing refresh cookie; Stripe webhook idempotency relies on `confirmPayment`/`confirmOrder`'s own idempotency rather than an event-ledger table like PayHere's.

**Out of scope / unable to verify from repository evidence this pass:** full frontend component/accessibility/performance audit; `notifications`, `sms`, `social` module internals; all 11 Prisma migrations individually; the AI service's prompt-injection defenses, cost controls, and evaluation harness in depth; whether a CD/deployment pipeline exists outside this repository; load-test results or production performance numbers (none exist in-repo to cite).
