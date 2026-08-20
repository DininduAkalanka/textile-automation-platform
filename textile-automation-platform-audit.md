# Production Readiness Audit
### Smart Textile Business Management & AI-Powered E-Commerce Platform
**Repo:** `DininduAkalanka/textile-automation-platform` (branch `main`)
**Audit basis:** full source pull (backend, frontend, AI service, Prisma schema + migrations, CI workflow, Docker/Compose, `docs/00–13`, `IMPLEMENTATION_PLAN.md`) — not the README alone.
**Audit panel:** Senior QA Engineer · Staff Software Engineer (10+ yrs) · Engineering/Product Lead · AI/ML Engineer
**Verdict:** **Conditional pass — not production-ready as shipped, but closer than 95% of capstone projects.** Core transactional logic (money, stock, auth) is built to a standard I'd accept in a commercial codebase. The gaps are concentrated in exactly the areas the project's own `IMPLEMENTATION_PLAN.md` marks as unfinished (Phase 10: hardening/deployment/monitoring), plus a frontend that has shipped with zero automated tests.

---

## 1. Scope & Method

This audit is evidence-based: every claim below cites the actual file and line-level behavior found in the repository, not the README's marketing copy. Where the README's claims were verified as true, that's stated explicitly; where they weren't, that's flagged as a finding.

| Component | Stack | Size |
|---|---|---|
| Backend | NestJS 11 · TypeScript · Prisma 6 · PostgreSQL 16 | 104 `.ts` source files, 81 REST endpoints across 13 controllers |
| Frontend | Next.js 16 (App Router) · TypeScript · Zustand · TanStack Query | 123 `.ts`/`.tsx` files (storefront, admin, worker portal) |
| AI service | FastAPI · Python 3.11 · statsmodels · asyncpg | 11 modules (RAG chat, function-calling BI assistant, forecasting) |
| Database | PostgreSQL, Prisma-managed | 22 models, 11 committed migrations |
| CI | GitHub Actions | 2 jobs (backend, frontend) against a real ephemeral Postgres |

---

## 2. Executive Summary

| Dimension | Grade | One-line reason |
|---|---|---|
| **Architecture** | A− | Clean service boundaries, single writer to the DB, AI service isolated on a read-only role — matches what's drawn in the README diagram. |
| **Backend engineering** | A− | Genuinely race-safe inventory ledger, idempotent payment webhooks, fail-fast config, layered RBAC. Best part of the codebase. |
| **AI/ML engineering** | B+ | Deliberately rejected text-to-SQL for a whitelisted tool-calling design; anti-hallucination "grounding" check on every generated number; honest, non-overfit forecasting model. Held back by zero CI coverage and default-secret hygiene. |
| **Frontend engineering** | C+ | Sound structure and no obvious client-side injection vectors, but **zero automated tests** and one real security smell (JWT in `localStorage`). |
| **QA / Test strategy** | B− | Backend integration suite is unusually rigorous for what it claims (a real-Postgres concurrency race test). Frontend and AI service are effectively untested in CI. |
| **DevOps / CI/CD** | C | CI lint gates are non-blocking; AI service has no CI job at all; backend container re-seeds on every boot. |
| **Security posture** | B− | Strong fundamentals (bcrypt-12, hashed+rotated refresh tokens, parameterized queries, env validation) undercut by inconsistent secret-default handling and a documented-but-unimplemented CSP. |
| **Production readiness (deploy-as-is)** | **D** | Would ship a live database re-seeded with publicly documented default admin credentials on every restart. This alone blocks a go-live sign-off. |

**Bottom line:** the people who built the transactional core (auth, orders, payments, inventory, AI guardrails) clearly know what they're doing and left comments explaining *why*, including admissions of bugs they'd already hit and fixed (a strong signal of real engineering discipline, not vibes). The gap between this and "production-ready" is not a knowledge gap — it's an unfinished punch list: Phase 10 of their own plan (hardening/deploy/monitoring) is visibly incomplete.

---

## 3. Findings — Severity Rated

### 🔴 Critical (blocks production go-live)

**C-1. Backend container re-seeds the database on every restart, with credentials published in the README.**
`backend/Dockerfile`:
```
CMD npx prisma migrate deploy && npm run db:seed && npm run start:prod
```
The Dockerfile's own comment says *"a production image must not run [db:seed]"* — and then runs it unconditionally anyway, with no `NODE_ENV` branch. `npm run db:seed` is idempotent against the demo catalogue, but it also (re)creates the seeded accounts (`admin@textileshop.com` / `Admin@123456`, `customer@example.com` / `Customer@123456`, two worker accounts) — passwords that are printed in plain text in the public README. If this Dockerfile is used as-is for a production image, every restart guarantees a live, documented, default admin account.
**Fix:** split the seed step out of the container entrypoint; run it as a one-time deploy-job step gated by `NODE_ENV !== 'production'`, or remove it from `CMD` entirely and document it as a manual `docker compose exec` step (which the README already does for `db:seed:history` — the same pattern should apply here).

**C-2. No production secret enforcement for the AI service or the AI database role.**
`backend/src/common/config/env.validation.ts` correctly fails the boot if `JWT_SECRET` is missing or under 32 characters — good, "fail loud, not silent" design. But `ai/app/config.py` gives `internal_api_key` and `database_url_readonly` hardcoded dev-value defaults (`"local-dev-internal-key"`, `.../ai_readonly_local_dev_password@...`) with **no equivalent validation**, and the same defaults are repeated in `docker-compose.yml`. There is nothing in the codebase that stops this from reaching production unchanged — no CI check, no boot-time assertion.
**Fix:** apply the same `pydantic` `field_validator` pattern already proven in the NestJS side — refuse to boot in a non-dev environment if these are unset or equal to the known default string.

### 🟠 High

**H-1. Frontend has zero automated tests.** 123 source files (storefront, `/admin` dashboard, `/worker` portal) — the entire customer- and staff-facing surface — has no unit, component, or e2e test in the repo. CI only runs `tsc --noEmit` and `next build`. Typechecking catches type errors, not logic regressions (a broken checkout button, a miscalculated cart total, an admin action hitting the wrong endpoint). For a system that touches money and physical production tasks, this is the single largest gap between "capstone" and "production."

**H-2. Lint is non-blocking in CI on both services.**
```yaml
- name: Lint
  run: npx eslint "{src,test}/**/*.ts"
  continue-on-error: true
```
The comment above it is candid about why (129 pre-existing errors, mostly `@typescript-eslint/no-unsafe-*` and Prettier), which is honest, but it means the "green CI" the README's badge advertises does not actually gate on lint quality — a new PR can introduce more `no-unsafe-*` violations and still merge clean.

**H-3. AI service is excluded from CI entirely.** The README documents `cd ai && pytest` as part of "Running the tests," and there are 3 real test files (`test_business.py`, `test_forecasting.py`, `test_guardrails.py` — the guardrails file is exactly the anti-hallucination logic that matters most). None of it runs in `.github/workflows/ci.yml`, which has only `backend` and `frontend` jobs. A regression in the grounding/anti-fabrication check — the thing standing between the owner and a hallucinated revenue figure — could ship silently.

**H-4. Access token stored in `localStorage`.** `frontend/src/store/useAuthStore.ts` and `services/http.ts` both persist the JWT access token via `localStorage.setItem('token', ...)`. This is inconsistent with the backend's own design: the refresh token is correctly issued as an `httpOnly` cookie (`res.cookie(REFRESH_COOKIE, token, { httpOnly: true, ... })` in `auth.controller.ts`), but the access token sits in a place any successful XSS can read. The 15-minute TTL limits the blast radius but doesn't eliminate it — and the `main.ts` comment says CSP "belongs on the Next.js origin," which was never actually implemented in `next.config.ts` (no CSP headers configured there either). Recommend moving the access token to an in-memory store (module-level variable / React context, refreshed via the httpOnly cookie flow) rather than `localStorage`.

### 🟡 Medium

**M-1. Backend Docker image is single-stage and runs as root.** No multi-stage build (unlike the frontend's `Dockerfile`, which does this correctly with a non-root `nextjs` user), so `devDependencies` and build tooling ship in the runtime image, and the process runs as root inside the container. Not exploitable on its own, but it's inconsistent with the standard already set by the other Dockerfile in the same repo, and it needlessly widens the container's attack surface.

**M-2. Phase 10 (hardening/deployment/monitoring) is documented but not implemented.** No Sentry or equivalent observability integration anywhere in `backend/package.json`, `frontend/package.json`, or `ai/requirements.txt`. No `RUNBOOK.md` or `CHANGELOG.md`, despite both being listed as required deliverables in `IMPLEMENTATION_PLAN.md` §12 and referenced from Session 10.2/10.3. `docs/12_DEPLOYMENT_ARCHITECTURE.md.txt` is explicitly marked `Status: Draft` and describes a target architecture (Vercel + Railway/AWS + Upstash Redis) that doesn't correspond to anything actually wired up in the repo (e.g., no Upstash config, no Vercel config beyond a generic `next.config.ts`).

**M-3. PayHere webhook signature comparison isn't constant-time.** `payments.service.ts` compares `localSig === md5sig.toUpperCase()` with a plain string equality rather than `crypto.timingSafeEqual`. The practical risk is low (MD5 hex digest, single comparison, not a high-value timing side channel), but it's a deviation from best practice on a code path that authenticates money-moving events, and it's a one-line fix.

**M-4. No pagination limits verified on some list endpoints during this pass** *(flagged for follow-up, not confirmed exploitable)* — worth a dedicated pass on `products`, `reviews`, and `analytics` list endpoints to confirm `take`/`limit` bounds are server-enforced and not just client-requested, given the AI tool layer is careful about this (`Field(..., le=10)` etc.) but the equivalent wasn't checked on every NestJS controller in this pass.

### 🟢 Low / Observations (not blockers)

- `console.log`/`warn`/`error` usage: 0 in backend (uses NestJS `Logger` consistently — good), 8 in frontend (acceptable for client debug, but worth an eslint rule to keep out of production bundles).
- `any` type usage is low and disciplined: 17 instances across 104 backend files, 6 across 123 frontend files — well below what's typical for a project this size.
- No hardcoded API keys/secrets found in any source file (`.env.example` files are correctly placeholder-only; `.gitignore` correctly excludes real `.env` files in all three services).
- No `dangerouslySetInnerHTML` anywhere in the frontend — no obvious stored-XSS vector from that pattern.

---

## 4. What's Actually Good (verified, not assumed)

It's easy for an audit to read as a wall of complaints, so it's worth being specific about what impressed the panel, because it's real engineering and the team should know which instincts to keep:

- **Inventory concurrency correctness is the standout.** The "race-safe stock reservation" claim in the README is backed by a genuinely defense-in-depth implementation: a guarded conditional `UPDATE ... WHERE quantity_available - quantity_reserved >= $qty` inside the caller's transaction, backstopped by a database-level `CHECK` constraint (`inventory_non_negative`) as a second, independent line of defense. The test for this (`test/stock-race.e2e-spec.ts`) fires real concurrent `Promise.all` requests against a real Postgres instance and asserts on the *specific rejection reason*, with a comment candidly explaining that an earlier, weaker version of this test passed even when the application-layer guard was removed — meaning they caught and fixed a false-positive test, which is a mature QA instinct.
- **Payment webhook handling follows the correct pattern end-to-end:** persist the raw event first (idempotency + audit trail) → verify signature → verify amount matches the order total exactly → only then mutate state, with an admin alert specifically for a *correctly-signed but amount-mismatched* event (the "someone's tampering or something's misconfigured" case, distinct from a bad signature).
- **The AI service's core design decision is the right one and it's enforced structurally, not just by convention:** the original spec (`docs/08_AI_INTEGRATION_DESIGN.md.txt`) called for text-to-SQL; a later decision (D9) explicitly overrode it because an LLM that writes SQL can be talked into writing different SQL. The replacement — six whitelisted, `pydantic`-bounded tool calls (enums, `ge/le` integer bounds, no free-form query surface) — plus a dedicated `ai_readonly_role` Postgres migration that `REVOKE`s write access outright, means the "AI can't touch your data" claim is actually true at the database layer, not just the prompt layer.
- **Anti-hallucination grounding check** (`ai/grounding.py`): every number the LLM states in the business-assistant's answer is checked against the actual tool output before the response ships; ungrounded numbers get caught rather than trusted. This is a non-obvious thing to build and most projects at this level skip it.
- **Forecasting model is honestly scoped.** `ai/forecasting.py` uses classical Holt-Winters exponential smoothing rather than reaching for a neural net it doesn't have the data volume to justify, degrades gracefully by data availability (naive average → linear trend → seasonal, based on how much history exists), and — notably — tells the owner in plain language when a forecast is low-confidence rather than presenting a guess as a number. That's a mature ML product decision, not just a modeling one.
- **Auth token lifecycle** is correctly designed: bcrypt cost factor 12, refresh tokens stored only as SHA-256 hashes (never plaintext in the DB), rotation on every refresh, and reuse-detection that revokes the entire token family if a already-rotated token is presented again — the standard mitigation for stolen-refresh-token replay.
- **Environment validation fails the process at boot**, not silently at request time, for every required secret — the exact right failure mode for a misconfigured deploy.

---

## 5. Prioritized Remediation Plan

| Priority | Item | Effort |
|---|---|---|
| 1 | Remove `db:seed` from the backend container's unconditional boot `CMD`; gate it behind an explicit deploy step or `NODE_ENV` check | Small |
| 2 | Add boot-time validation for `INTERNAL_API_KEY` / `DATABASE_URL_READONLY` in the AI service (mirror the NestJS `env.validation.ts` pattern) | Small |
| 3 | Stand up a frontend test suite — start with the checkout flow, cart total calculation, and admin order-status transitions, since those are the highest-consequence paths | Medium–Large |
| 4 | Add the AI service to the CI workflow as a third job (`pytest`, already written and passing locally per repo state) | Small |
| 5 | Make backend + frontend lint gates blocking again once the 129 pre-existing errors are triaged (can be done incrementally per-directory) | Medium |
| 6 | Move the frontend access token out of `localStorage` into memory-only storage, refreshed via the existing httpOnly-cookie flow | Small–Medium |
| 7 | Multi-stage, non-root backend Dockerfile (mirror the frontend's already-correct pattern) | Small |
| 8 | Write the `RUNBOOK.md` and wire up basic error monitoring (Sentry or equivalent) before calling Phase 10 done | Medium |
| 9 | `crypto.timingSafeEqual` for the PayHere signature comparison | Trivial |

---

## 6. Sign-off Recommendation

**Do not deploy the current `main` branch to a live production environment as-is.** C-1 and C-2 are the only two items in this audit rated Critical — everything else (the High, Medium, and Low items) is a risk-reduction recommendation, not a go/no-go blocker in the strict sense. So, directly: **yes — once C-1 and C-2 are fully and correctly closed, the hard blockers this audit identifies are cleared, and the platform is deployable.** Concretely, "closed" means:
- **C-1:** the backend container no longer unconditionally re-seeds the database on every restart (seed step removed from `CMD` or gated behind an explicit non-production check), and the demo admin/customer/worker accounts from the README are rotated or removed from any environment reachable from production.
- **C-2:** `INTERNAL_API_KEY` and the AI read-only DB role's password both fail the boot (like `JWT_SECRET` already does) if left at their dev defaults in a non-dev environment, and the actual production values are set to real, non-default secrets.

Two caveats worth flagging honestly rather than burying: first, closing C-1 and C-2 removes the two *Critical* items, but H-1 (zero frontend test coverage, including the checkout flow) remains open — for a system that moves real money via PayHere, I'd still push to get at least a checkout/payment smoke test in place before go-live, even though it's technically a High rather than a Critical finding. Second, this audit was a static code review, not a penetration test or a live fire-drill of the actual fix — I'd want to see C-1 and C-2 verified against a real staging deploy (confirm no default credentials survive a restart, confirm the AI service actually refuses to boot with a default secret) rather than just merged, before calling it done.

Short version: **C-1 + C-2 closed and verified = cleared to deploy from this audit's standpoint.** The underlying architecture and the backend/AI engineering don't need a rewrite, they need the punch list finished.

For a **university capstone evaluation**, this is well above the bar: the concurrency handling, payment idempotency, and AI guardrail design each reflect decisions and trade-offs a working engineer would actually make, and the code comments consistently explain *why*, including admitted past mistakes — which is a rarer and more valuable signal than clean code alone.

---
*Audit performed by static review of the full repository contents (source, migrations, CI config, Docker/Compose, and design docs). No dynamic penetration testing, dependency CVE scan, or load testing was performed as part of this pass — recommended as a follow-up before any production deployment.*
