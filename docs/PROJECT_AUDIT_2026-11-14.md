# Nandana Textile - Project Audit

**Date:** 14 November 2026  
**Review result:** Fix the critical security issue before going live.  
**Scope:** Audit report only. No application fixes were applied.

<!-- READABLE_AUDIT_V1 -->

## Read this first

The project has substantial working features, but the audit found issues that must be addressed before a production release.

**The most serious issue is account access:** guest checkout can return a login session for an existing account, including an administrator account, without its password or verification code. This behavior was reproduced with a test account and isolated mocks. No real account was accessed.

There are also important problems in payment processing, stock records, checkout verification, and the separation of AI service credentials.

| Priority | Findings | Meaning |
| --- | ---: | --- |
| **Critical** | **1** | A serious account-access problem that needs immediate attention. |
| **High** | **14** | Significant risks to security, payments, stock, checkout, or privacy. |
| **Medium** | **13** | Reliability, validation, reporting, and operational problems. |
| **Total** | **28** | All findings are explained below. |

**Passing tests do not mean the project is ready to launch.** The current tests pass for the situations they cover, but several important failure cases are missing or accept incorrect results.

## What passed, and what remains unverified

| Check | Result |
| --- | --- |
| Backend automated unit tests | **Passed: 163 tests across 16 suites.** |
| Backend and frontend TypeScript checks | **Both passed.** |
| Backend and frontend production builds | **Both passed.** |
| Backend code-quality check | **Failed: 71 errors and 158 warnings.** |
| Frontend code-quality check | **No errors; 107 warnings.** |
| Software dependency scans | **21 affected package entries**, including 2 rated critical and 11 rated high. Actual exposure depends on how the software is used and hosted. |
| Python AI tests | **Could not run:** the local environment is missing asyncpg. |
| Live database, browser journeys, and load tests | **Not run during this audit.** |

These are results from the original assessment. Reformatting this report did not rerun tests or change the project.

## What should be fixed first

1. **Protect account access.** Stop guest checkout from signing into existing accounts without proof of ownership. Restrict which websites can use login cookies.
2. **Protect private data and credentials.** Clear private browser data when accounts change, remove verification codes from production logs, and restrict the AI service's secrets and database access.
3. **Make payment processing recover safely.** A retry must complete interrupted work without creating duplicate changes or leaving a paid order unconfirmed.
4. **Keep stock records consistent.** Record every stock change, validate each garment size, handle simultaneous requests safely, and release abandoned reservations.
5. **Complete the checkout journeys.** Repair cash-on-delivery verification and either complete the installment payment flow or remove that option until it works.
6. **Strengthen release checks.** Update affected libraries, fix misleading tests, and run the missing database, browser, AI, and operational checks.

These are recommendations. **No fixes have been applied to the application.**

## All 28 findings in plain language

Each finding keeps its original ID so it can be matched to the technical evidence.

### Account security and privacy

- **A01 - Critical: Guest checkout can sign into someone else's account.** Matching an existing email or phone number can produce that account's login session, including an administrator session.
- **A03 - High: The browser access policy trusts unrelated Vercel websites.** In affected browser and cookie conditions, another Vercel tenant could read a session-refresh response.
- **A10 - High: Verification codes are written to logs.** Production code logs the code and its destination, exposing them to people who can read those logs.
- **A15 - Medium: Disabling an account does not fully stop its sessions.** Existing refresh tokens can still obtain new sessions, and token rotation does not safely handle all simultaneous requests.
- **A16 - Medium: Login sessions behave inconsistently.** Different refresh mechanisms, direct-page initialization, and cookie settings can cause failed reloads or unexpected sign-outs.
- **A18 - Medium: Public product responses include internal information.** They can expose cost prices and allow archived products to be retrieved directly.
- **A28 - High: One account's cached data can remain after another signs in.** In the same browser, private order or notification data could appear under the next account.

### Orders, payments, and checkout

- **A04 - High: A failed payment notification may never be processed on retry.** An earlier stored notification can block a later valid attempt, even when the first attempt failed.
- **A05 - High: Payment and order status can disagree.** Interrupted or out-of-order processing can leave a payment completed while its order remains pending, or incorrectly overwrite a payment state.
- **A11 - High: Cash-on-delivery and verification flows are incomplete.** Some customers are asked for a code that was never sent; successful guest COD checkout can also miss payment creation and order confirmation.
- **A12 - High: Installment payments are not complete or consistently recorded.** The flow has missing input limits, inconsistent currency, risks to existing payment history, and misleading first-payment success messages.
- **A17 - Medium: Order validation rejects some valid carts and accepts empty ones.** Buying the same product in two sizes can fail, while an order with no items and blank address strings passes validation.
- **A24 - Medium: Financial reports can give the wrong picture.** Payments can be labelled refunded before money is returned, and later cost-price changes can alter historical profit figures.

### Stock and factory work

- **A06 - High: Editing product sizes can change stock without a stock movement record.** This bypasses the inventory history and can make stock totals inconsistent.
- **A07 - High: Simultaneous requests can process the same change incorrectly.** Cancellation and production actions do not consistently recheck the latest state under a database lock or equivalent protection.
- **A08 - High: Garment-size stock is not fully protected.** Concurrent purchases can oversell a size, and size selections are not always checked against the product's actual options.
- **A09 - High: Unpaid orders can hold stock indefinitely.** Abandoned checkout does not automatically release reserved stock, and repeated submissions can create extra reservations.
- **A25 - Medium: Low-stock pages and labels can be misleading.** Filtering happens after pagination, and physical stock is not clearly distinguished from stock still available to buy.

### AI service

- **A13 - High: The supplied deployment gives the AI service too many credentials.** The Compose configuration passes backend secrets to AI and uses development defaults that require strict isolation.
- **A14 - High: The setup guide grants AI too much database access.** Following the runbook can allow reads of sensitive tables beyond the intended catalog and analytics views.
- **A20 - Medium: AI answers can pass checks while still being wrong.** The checks do not reliably connect each claim or chart value to the correct source data.

### Customer-facing features

- **A21 - Medium: Some features show success without doing the advertised work.** The contact form does not deliver inquiries, newsletter submission is not connected, and visual search uses filenames or preset keywords instead of analyzing image content.

### Deployment, testing, and operations

- **A02 - High: Installed libraries have published security advisories.** Upgrade and assess the affected versions; the scan alone does not prove every advisory can be exploited here.
- **A19 - Medium: Image uploads need stronger validation and storage controls.** File labels are trusted without verifying image content, and quotas and cleanup are missing.
- **A22 - Medium: Health checks can report success while the database is unavailable.** Deployment tools may treat an unusable service as healthy.
- **A23 - Medium: Some tests can pass without proving the intended behavior.** Selected payment and access-control tests accept incomplete results, and required CI checks are missing or non-blocking.
- **A26 - Medium: Request limits are not shared across API instances.** Limits can behave differently when the application scales or sits behind a hosting proxy.
- **A27 - Medium: Important actions and message delivery need better records.** Some administrator changes lack consistent attribution, and failed customer messages have no durable automatic retry.

## What is already good

The audit found useful foundations worth keeping:

- Password hashing and authentication requirements on protected API routes.
- Order prices calculated by the server.
- Database transactions and guarded updates for aggregate stock.
- Shared rules for order and production stages.
- Ownership checks for customer records and assigned-worker tasks.
- AI tools that use predefined database queries.
- Production builds, automated unit tests, migrations, and operational documentation.

The findings identify gaps around these controls; they do not mean every part of the project is broken.

## What this assessment can confirm

Some defects were reproduced by running actual project code with test fixtures and mocks. Other findings were established by reading the relevant implementation. Deployment-related risks require checks against the real hosting environment.

No production attack, real customer access, payment charge, or database modification was performed. Live infrastructure settings, backups, and real payment-provider behavior remain unverified.

## Technical evidence and implementation guidance

Expand the section below for the original assessment, file and line references, commands, build output, recommended fixes, and retest criteria.

<details>
<summary><strong>Open the full technical audit</strong></summary>


# Nandana Textile — Comprehensive Project Audit

**Assessment date:** 14 November 2026 (Asia/Colombo)  
**Repository:** Smart-Textile-Business-Management-E-Commerce-Platform-with-AI-Intelligence  
**Branch:** chore/qa-audit-and-type-hardening  
**Commit:** c85641810f75d458b7a8ea7db165e5c1328fa830  
**Assessment type:** Repository-wide technical risk review, local automated checks, dependency assessment, and isolated defect reproductions  
**Handling:** Internal technical assessment. No environment secret values are included.

---

## 1. Executive assessment

**Release recommendation: HOLD production release until the critical authentication defect and the high-priority integrity issues are resolved and retested.**

The application implements substantial business functionality: catalog management, customer ordering, inventory movements, production workflows, payments, reviews, notifications, invoices, social publishing, and an isolated Python AI service. Its foundations include useful controls such as a global authentication guard, server-calculated order prices, bcrypt password hashing, database transactions, guarded inventory updates, and AI queries restricted to defined tools.

Those controls do not currently provide a safe production release. Most seriously, public guest checkout can issue an authenticated session for an existing account solely from a matching email or phone number. An isolated reproduction issued an ADMIN session for an inactive, unverified fixture account without a password or OTP. Other confirmed reproductions showed lost webhook retries, poisoned webhook deduplication, inventory edits without ledger movements, and insufficient request validation.

Existing passing test totals should be interpreted as evidence about the scenarios those tests assert. They do not establish the absence of these defects.

### Finding distribution

| Severity | Count | Interpretation |
| --- | ---: | --- |
| Critical | 1 | Confirmed authentication bypass with administrative account impact |
| High | 14 | Material security, payment, stock, customer-data, or checkout risk |
| Medium | 13 | Reliability, validation, accounting, assurance, or operational weaknesses |
| **Total** | **28** | Distinct findings; individual findings may describe related symptoms |

Dependency scans separately report **two critical advisory entries**, one in each dependency tree. These registry severity counts are not additional application findings and do not prove every advisory is reachable in this deployment.

### Business impact

| Business area | Assessment | Principal consequences |
| --- | --- | --- |
| Account and administrative access | Critical | Unauthorized customer or administrator sessions |
| Payments and order reconciliation | High risk | Paid-but-unconfirmed orders, lost retries, inconsistent payment states |
| Inventory and garment sizes | High risk | Ledger drift, size overselling, incorrect reservations and availability |
| Customer checkout | High risk | COD dead ends, incomplete installment flow, misleading success states |
| AI isolation and output integrity | High risk / deployment-dependent | Excessive service credentials, possible business-data exposure, unsupported generated claims |
| Test and operational assurance | Incomplete | Passing suites omit important failure paths; readiness checks can report success during DB failure |

## 2. Scope, method, and limitations

The repository inventory contains **468 tracked files**, approximately **57,123 lines across tracked TypeScript, TSX, Python, and SQL files**, **22 Prisma models**, and **10 migration directories**. The line count includes tests, migrations, and seed data; it is not a production-code-only metric.

The review covered:

- Backend authentication, authorization, validation, order, payment, inventory, production, product, review, upload, analytics, notification, invoice, email, SMS, social, and AI gateway paths.
- Frontend checkout, authentication and session state, API clients, query caches, customer/admin/worker flows, cart behavior, product discovery, contact functionality, and selected SEO and performance configuration.
- Prisma schema and migrations, inventory reconciliation, read-only AI permissions, Python retrieval, business tools, numerical grounding, and forecasting.
- Dockerfiles, Compose, CI, test suites, load scripts, deployment/security documentation, and environment handling.

Methods included source tracing across controllers/services/DTOs, read-only repository searches, TypeScript checks, unit tests, ESLint assessment without auto-fix, npm registry audits, and isolated in-memory reproductions against the actual service classes. Selected dependency and payment specifications were checked against primary sources.

**Evidence categories:**

- **Reproduced:** Actual project code executed with isolated mocks or DTO validation. This verifies the identified code behavior, not live database or HTTP behavior.
- **Source-confirmed:** The relevant implementation was traced; a full live integration reproduction was not performed.
- **Conditional:** Impact depends on deployment settings, infrastructure, browser behavior, or use of a feature.

**Limits:** No live production endpoint was attacked, no real customer account was accessed, no gateway charge was made, and no real database record was changed. Integration, Cypress, migration replay, reconciliation against a real database, restore drills, and k6 runs were not executed because their running services/tooling were unavailable in the accessible local environment. The host uses Node 24.16.0 and Python 3.14.6; CI/container versions differ. Python tests failed during collection because asyncpg was unavailable. Cloud hosting configuration, gateway merchant status, actual database grants, backup retention, TLS, and incident history were not independently verified.

This is a broad technical audit with explicit evidence boundaries, not a penetration-test certificate, legal compliance assessment, exhaustive review of every dependency's source, or proof that all defects have been found.

## 3. Verification performed in this assessment

| Check | Result | Evidence / interpretation |
| --- | --- | --- |
| Backend unit tests | **PASS** | 16 suites, 163 tests; 14.559 seconds |
| Backend TypeScript | **PASS** | tsc --noEmit --incremental false -p tsconfig.build.json |
| Frontend TypeScript | **PASS** | tsc --noEmit --incremental false |
| Backend production build | **PASS** | npm --prefix backend run build; output excerpt in Appendix B |
| Frontend production build | **PASS** | npm --prefix frontend run build; output excerpt in Appendix B |
| Backend ESLint | **FAIL** | 120 files examined; 71 errors and 158 warnings; no auto-fixes |
| Frontend ESLint | **PASS with warnings** | 152 files examined; 0 errors and 107 warnings; configured ignores apply |
| AI pytest | **BLOCKED during collection** | Three test modules fail to import because asyncpg is missing; no tests executed |
| Backend dependency audit | **Findings** | 14 package entries: 1 critical, 6 high, 3 moderate, 4 low |
| Frontend dependency audit | **Findings** | 7 package entries: 1 critical, 5 high, 1 moderate |
| Integration / Cypress / k6 | **NOT EXECUTED** | Historical repository claims were not treated as new results |
| Isolated defect checks | **Defects reproduced** | Account session issuance, webhook retry and poisoning, ledger bypass, DTO acceptance, grounding counterexamples |

The expected amount-mismatch error emitted by a backend payment test did not represent a failed test. Both npm audits used **npm audit --omit=dev --json** and reflect registry results at assessment time. Package counts include dependency chains and inherited advisories, rather than unique exploitable attack paths.

## 4. Findings register

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| A01 | Critical | Guest checkout can authenticate as an existing account | Reproduced |
| A02 | High | Locked dependencies have critical/high advisories | Registry-confirmed; exposure conditional |
| A03 | High | Credentialed CORS trusts unrelated Vercel tenants | Source-confirmed; browser-dependent |
| A04 | High | Webhook deduplication loses retries and can be poisoned | Reproduced |
| A05 | High | Payment state changes lack atomic reconciliation and transition checks | Source-confirmed; partial failure reproduced |
| A06 | High | Product size edits bypass the inventory ledger | Reproduced |
| A07 | High | Order and production state changes race on stale reads | Source-confirmed |
| A08 | High | Size inventory and measurement eligibility trust insufficiently validated selections | Source-confirmed |
| A09 | High | Unpaid reservations have no automatic expiry or checkout idempotency | Source-confirmed |
| A10 | High | OTP values and destinations are logged in production paths | Source-confirmed |
| A11 | High | COD checkout and inline OTP flows are incomplete | Source-confirmed |
| A12 | High | Installment flow has validation, currency, and payment-history defects | DTO issue reproduced; remaining issues source-confirmed |
| A13 | High | AI deployment receives excessive secrets and uses exposed development defaults | Conditional deployment finding |
| A14 | High | Runbook grants AI access beyond its intended data boundary | Source-confirmed documentation defect |
| A15 | Medium | Account disablement and refresh rotation are incompletely enforced | Source-confirmed |
| A16 | Medium | Session initialization, refresh coordination, and cookie contracts diverge | Source-confirmed |
| A17 | Medium | Order DTOs accept empty orders; multiple sizes of one product fail | DTO issue reproduced; line handling source-confirmed |
| A18 | Medium | Public product responses expose internal fields and archived products | Source-confirmed |
| A19 | Medium | Upload controls do not verify content or manage storage lifecycle | Source-confirmed |
| A20 | Medium | AI grounding does not validate all customer claims or chart values | Grounding counterexamples reproduced |
| A21 | Medium | Customer-facing forms and visual search claim work they do not perform | Source-confirmed |
| A22 | Medium | Health endpoints return successful HTTP status during database failure | Source-confirmed |
| A23 | Medium | CI and selected E2E assertions provide incomplete release assurance | Source-confirmed |
| A24 | Medium | Refund and reporting semantics can misstate financial position | Source-confirmed |
| A25 | Medium | Low-stock filtering and availability indicators can be misleading | Source-confirmed |
| A26 | Medium | Rate limiting is process-local and production settings are weakly separated | Source-confirmed; scaling impact conditional |
| A27 | Medium | Important business actions and outbound delivery lack durable audit/retry records | Source-confirmed |
| A28 | High | Private query caches survive account changes without user scoping | Source-confirmed; shared-browser impact |

## 5. Detailed findings

### A01 — Critical: Guest checkout can authenticate as an existing account

**Evidence:** backend/src/auth/auth.service.ts:206, :220, :245; backend/src/orders/orders.service.ts:51; backend/src/orders/orders.controller.ts:51.

The public checkout path looks up a user by matching either submitted contact, reuses any returned account, and calls issueSession with that user's actual role. It does not authenticate the existing user, restrict the match to customers, reject inactive accounts, or require OTP for non-COD checkout. A supplied password is only used when creating a new account.

**Reproduction:** Calling the real guestCheckout and AuthService classes with an existing inactive, unverified ADMIN fixture and an isolated order stub returned a valid ADMIN access token and created a refresh session. No password, OTP, database, or real account was used.

**Impact:** Account takeover and administrative access. Knowledge of a contact is incorrectly treated as proof of account ownership.

**Required correction:** Require authenticated identity or verified contact ownership before linking an existing account or returning any account session. Never infer identity from an OR contact lookup. Reject conflicting email/phone matches and inactive users. Separate unauthenticated guest order access from registered-account authentication.

**Retest:** Anonymous attempts using existing customer, worker, manager, admin, inactive, and conflicting-contact fixtures must never return their access or refresh sessions.

### A02 — High: Locked dependencies have critical/high advisories

**Evidence:** backend/package-lock.json; frontend/package-lock.json; live npm audit results.

Locked examples include Next 16.3.2, Axios 1.18.1, Sharp 0.35.3, Multer 2.2.0, body-parser 2.3.0, and proxy-addr 2.0.7. The backend audit reports 14 affected package entries and the frontend reports 7.

The Next advisory for Windows-hosted servers applies below 16.3.3; this is relevant to Windows hosting, while the repository's Linux container has different exposure. Other Next advisories depend on image optimization or cache features. The current unoptimized image setting reduces exposure to some image paths. The proxy-addr advisory requires assessment of trusted-proxy configuration. A registry severity does not establish exploitability here. See the [maintainer's Windows-hosting advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [proxy-addr advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), and [Multer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m).

**Correction:** Upgrade to supported versions unaffected by the complete current advisory set, refresh both lockfiles, assess transitive/runtime reachability, and regression-test uploads, payments, authentication, and deployment. Handle Prisma and Zod major-version changes deliberately; do not apply force upgrades without compatibility review.

**Retest:** Repeat production dependency audits and document any retained advisory with its actual attack-path assessment.

### A03 — High: Credentialed CORS trusts unrelated Vercel tenants

**Evidence:** backend/src/main.ts:44; backend/src/auth/auth.controller.ts:47, :89.

The CORS policy accepts every origin ending in .vercel.app and allows credentials. Production login/refresh cookies use SameSite=None. An attacker-controlled Vercel deployment can therefore be an approved browser origin for the refresh endpoint. Where the browser sends the cookie, the response may expose a newly minted access token to that origin.

**Correction:** Use an exact, environment-specific trusted-origin list. Apply origin/CSRF defenses to cookie-authenticated session endpoints and unify cookie policy with the intended domain topology. OWASP describes the risks of overly broad subdomain CORS trust in its [CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

**Retest:** An unrelated Vercel tenant and an untrusted sibling origin must not read refresh responses or perform session-changing operations. Test actual supported browsers; third-party-cookie policies affect exposure.

### A04 — High: Webhook deduplication loses retries and can be poisoned

**Evidence:** backend/src/payments/payments.service.ts:685, :698, :721, :754; backend/prisma/schema.prisma:432.

A webhook event is inserted before signature acceptance and business processing. Any unique-key conflict immediately returns duplicate=true, regardless of whether the earlier event was valid or processed successfully.

**Reproductions:** A signed notification whose order confirmation threw a simulated transient error was acknowledged as a duplicate on retry; confirmation was not retried. An invalid-signature event followed by a valid event with the same identifier also resulted in duplicate=true without confirmation.

**Impact:** Payments can become permanently unreconciled. An invalid event can reserve a deduplication identity before the genuine event arrives; targeting depends on knowing or predicting that identity.

**Correction:** Authenticate before claiming the processing identity, retain rejected payloads separately, and implement recoverable processing states with atomic claiming and retry. A stored row must not mean successful completion.

**Retest:** Inject failures after event receipt, payment update, order confirmation, and before final acknowledgement. Replays must converge exactly once to the correct payment, order, and ledger state.

### A05 — High: Payment changes lack atomic reconciliation and state guards

**Evidence:** backend/src/payments/payments.service.ts:546, :737, :754, :781, :876, :939; backend/src/orders/orders.service.ts:715.

Payment updates commit separately from order confirmation. A confirmation failure can leave a COMPLETED payment attached to a PENDING order. The isolated webhook check reproduced this split state.

Payment creation helpers generally check ownership and whether the payment is already completed, rather than whether the order is payable. They can operate on cancelled orders. The failure branch can overwrite a completed payment with FAILED after another gateway event. PayHere compares the amount to the order total but does not compare the notified currency to the expected currency. Admin mark-paid can mark a cancelled-order payment completed while confirmOrder silently does nothing.

**Correction:** Lock and validate the order/payment aggregate, apply explicit payment transitions, verify amount, currency, method and attempt identity, and reconcile payment/order/ledger changes atomically or through a recoverable workflow. Preserve late-success events for refund/reconciliation rather than blindly changing state.

**Retest:** Cover success/failure reordering, cancelled orders, concurrent payment methods, duplicate success, currency mismatch, and failure between every durable write. PayHere's notification contract distinguishes checkout hashes from callback signatures; see its [Checkout API documentation](https://support.payhere.lk/api-%26-mobile-sdk/checkout-api).

### A06 — High: Product size edits bypass the inventory ledger

**Evidence:** backend/src/products/products.service.ts:577; backend/src/products/dto/update-product.dto.ts:4.

Although UpdateProductDto excludes stockQuantity, attributes.sizeStock remains writable. ProductsService sums that JSON and directly sets both product stockQuantity and inventory quantityAvailable without creating a movement or stock-adjustment audit record. It also sets the cache to available rather than available minus existing reservations.

**Reproduction:** Editing sizeStock to S=10, M=20 wrote product stock=30 and inventory available=30 with zero movement writes.

**Impact:** Stock can be created or removed outside the ledger; existing reservations can make the cache incorrect. Database non-negative checks do not enforce ledger reconciliation.

**Correction:** Route stock-changing size edits through validated inventory commands with row locks, reservation-aware calculations, movements, and actor audit. Keep product metadata updates separate from stock counts.

**Retest:** Edit sizes with active reservations and after sales; reconcile product totals, per-size totals, reserved stock, and movements.

### A07 — High: Order and production transitions race on stale reads

**Evidence:** backend/src/orders/orders.service.ts:434, :475, :597, :649; backend/src/production/production.service.ts:242, :284, :372.

Cancellation checks order status outside its transaction and writes by ID without a locked recheck. Two cancellations can both release/restock from the same old state. Because reservations are guarded at product level, a repeated release may consume capacity reserved by another order. Confirmation uses an order lock, but cancellation does not follow the same protocol.

Production assignment and task actions also read then update without compare-and-set state predicates or row locks. Cancellation leaves production tasks available in pipeline queries, while terminal-order handling only skips status synchronization.

**Correction:** Establish one lock order for order, payment, inventory and task operations. Check transitions under that lock or use version/state predicates, and make cancellation idempotent. Prevent work on cancelled orders and resolve outstanding tasks consistently.

**Retest:** Race cancel/cancel, cancel/confirm, cancel/production-start, task reassignment/start, and simultaneous task completion on the same order against PostgreSQL.

### A08 — High: Size and measurement rules lack authoritative variant validation

**Evidence:** backend/src/orders/orders.service.ts:154, :263; backend/src/orders/measurements.config.ts:317, :344.

Size quantities are checked from product data read before the transaction, then written back from the same stale JSON snapshot. Concurrent orders can both pass a size check and overwrite its remaining count even while aggregate inventory reservation is serialized. Unknown or omitted sizes can avoid size-specific checks. Standard-size recognition also bypasses measurement validation without proving that the selected size is actually offered for that product.

**Correction:** Represent authoritative variants and their stock/reservations explicitly, validate selections against the product's allowed variants, and update quantities atomically. Permit the standard-size measurement exception only for a valid ready-to-wear selection on that product.

**Retest:** Concurrently order the last unit of one size while other sizes remain available. Reject nonexistent sizes and invalid measurement bypasses; retain the intended legitimate standard-size checkout behavior.

### A09 — High: Unpaid stock reservations have no expiry or attempt idempotency

**Evidence:** backend/src/orders/orders.service.ts:225, :249; backend/prisma/schema.prisma:265; backend/src/payments/payments.service.ts:766, :911.

Orders reserve stock at creation. No order-reservation expiry field or scheduled release path was found. Failed payments explicitly leave reservations in place. Public guest checkout can create unpaid reservations, and repeated checkout submissions have no stable request identity.

**Impact:** Abandoned or intentionally repeated checkout can make inventory unavailable indefinitely. Retrying after a gateway/setup failure can create more orders and reservations.

**Correction:** Introduce expiring reservation records, payment-attempt identifiers and checkout idempotency keys, with a monitored release job. Coordinate expiry with late payment success.

**Retest:** Abandon checkout, fail payment, repeat requests, and deliver a delayed success near expiry. Inventory must reconcile without losing a valid payment or double-reserving stock.

### A10 — High: OTP codes and destinations are logged unconditionally

**Evidence:** backend/src/verification/verification.service.ts:74; backend/src/sms/sms.service.ts:48; backend/src/email/email.service.ts:67.

sendCode logs the plaintext OTP and destination regardless of NODE_ENV. The production guard protects the fixed development bypass, but it does not protect the log statement. Missing-provider delivery paths can also log OTP-bearing messages or email previews.

**Impact:** Anyone with relevant log access can obtain active contact-verification codes and contact details.

**Correction:** Remove OTP bodies from production logs, redact destinations, and make missing required delivery configuration fail clearly in production. Keep development diagnostics behind an explicit non-production guard.

**Retest:** Capture logs for successful, failed and unconfigured delivery in production mode; no OTP or full sensitive message should appear.

### A11 — High: COD checkout and inline OTP flows are incomplete

**Evidence:** frontend/src/app/(shop)/checkout/page.tsx:164, :206, :229, :258, :949; backend/src/orders/orders.service.ts:56, :64, :100.

New guest COD checkout requires verified contact, but guest provisioning does not dispatch an OTP. The frontend only sends a code when isAuthenticated is true; on a guest verification error it can show an OTP UI without sending a code. For authenticated checkout, the modal retries order creation without calling verifyContactCode. Phone-only users are also routed to an EMAIL send.

Successful guest COD checkout returns an order, but its frontend branch clears the cart and navigates without creating the COD payment or confirming the order. The authenticated branch does perform that payment step.

**Correction:** Design one explicit contact-verification state machine, expose an appropriate guest verification workflow, and use the verified channel. Complete COD payment creation and order confirmation consistently before presenting success.

**Retest:** New guest, returning guest, email-only, phone-only, unverified registered and already verified customers must all complete the intended COD flow with correct payment, order, reservation and production records.

### A12 — High: Installments have validation, currency and history defects

**Evidence:** backend/src/payments/dto/create-payment.dto.ts:17; backend/src/payments/payments.service.ts:100, :120, :139, :163, :876; frontend/src/app/(shop)/checkout/page.tsx:235, :265; frontend/src/app/account/orders/[id]/installments/page.tsx:79, :236.

installmentCount has only IsOptional: it has no integer/minimum/maximum constraint. Validation accepted a count of one billion in an isolated DTO check. Invalid values can produce malformed schedules or excessive database work.

The service treats order values as USD for Stripe/payment records while the storefront presents LKR. Recreating a partially paid plan is allowed while its overall status is PENDING and deletes existing installment records. Checkout creates the plan, then redirects without collecting the first payment, yet the success page says that payment was processed. Per-installment payment is not exposed through a functioning customer route; admin mark-paid updates the overall payment rather than the installment ledger.

**Correction:** Disable the offered plan until its end-to-end payment contract is complete, or implement bounded counts, consistent currency, immutable payment history, valid installment collection and accurate success states.

**Retest:** Reject negative, fractional, string and excessive counts; preserve paid entries on retries; verify first and later payments, rounding, cancellation and partial refunds.

### A13 — High: AI deployment receives excessive secrets and development defaults

**Evidence:** docker-compose.yml:49, :57, :66, :90, :92; ai/app/config.py:22; backend/prisma/migrations/20260712010000_ai_readonly_role/migration.sql:17.

Compose injects backend/.env into the AI container. This gives that service backend credentials beyond its read-only DB URL, including any primary database, signing, payment, or messaging secrets in the file. The checked local backend environment contains configured sensitive integrations; their values were not printed or included here.

The same development Compose publishes AI, PostgreSQL and Redis ports on default host interfaces and uses known development service/JWT/database defaults. The AI settings also have a known shared-key fallback. These settings are acceptable only within a deliberately controlled development context. Production exposure was not tested.

**Correction:** Provide an AI-specific environment containing only required secrets, remove production fallback credentials, use private service networking, and separate development and production manifests. Gate demo seeding and avoid public default accounts in production.

**Retest:** Inspect the deployed AI environment and verify it cannot access backend signing or payment credentials. Verify public-network reachability and service authentication separately.

### A14 — High: Runbook defeats the AI read-only data boundary

**Evidence:** docs/RUNBOOK.md:79, :85; backend/prisma/migrations/20260712010000_ai_readonly_role/migration.sql:35.

The migration grants SELECT only on catalog/inventory tables, with separate PII-reduced analytics views. The production runbook instead grants SELECT on all existing tables and default SELECT on future tables. Following that procedure exposes users, password hashes, contacts, addresses, payments and future sensitive tables to the AI role.

The migration comment also claims an AI_DB_PASSWORD override, but the SQL itself creates the role with a literal development password; no such substitution mechanism was found in this path.

**Correction:** Replace the runbook grants with the explicit table/view allow-list. Provision and rotate production role credentials through a real secret-management procedure. Review effective grants in any existing deployment.

**Retest:** Under the AI role, permitted catalog/views must work; reads of users, orders, payments and measurements, and all writes, must fail.

### A15 — Medium: Account disablement and refresh rotation are incomplete

**Evidence:** backend/src/auth/auth.service.ts:135, :159; backend/src/auth/strategies/jwt.strategy.ts:29.

Password login checks isActive, but refresh does not. JWT validation returns the token's role without consulting account state. A disabled user can continue obtaining sessions through an existing valid refresh token; role changes remain stale in access tokens. Rotation also reads a refresh record and then revokes it through an unconditional update, allowing concurrent requests to both observe it as active.

**Correction:** Enforce account status on refresh, define the acceptable revocation delay for access tokens, and use atomic token consumption/rotation with session-family semantics. Handle legitimate concurrent refresh safely.

**Retest:** Disable or demote an account after login; run parallel refreshes with the same token and validate the intended session policy.

### A16 — Medium: Session lifecycle contracts diverge

**Evidence:** frontend/src/services/http.ts:86, :140; frontend/src/lib/api.ts:29, :80, :112; frontend/src/store/useAuthStore.ts:137; frontend/src/app/worker/layout.tsx:17; frontend/src/app/account/orders/page.tsx:38; backend/src/orders/orders.controller.ts:70.

The Axios client and legacy fetch client have separate refresh coordination, while explicit api.refresh performs another independent call. There is no cross-tab coordination. These paths can rotate the same cookie concurrently and trigger reuse detection.

Unlike shop/admin layouts, direct account/worker routes do not consistently bootstrap the in-memory token through loadUser. Axios intentionally does not refresh a request that had no Authorization header, making direct reloads of affected routes unreliable. Guest cookies always use SameSite=Lax while production login uses None, so guests have a different cross-site refresh contract.

**Correction:** Centralize session bootstrap, refresh coordination and cookie policy; gate private queries until initialization completes; coordinate rotation across tabs or make the server tolerant of legitimate concurrency.

**Retest:** Reload customer/worker URLs directly, expire tokens while mixed API clients are active, open two tabs, and test the actual production frontend/API domain arrangement.

### A17 — Medium: Empty orders pass validation; valid size combinations fail

**Evidence:** backend/src/orders/dto/create-order.dto.ts:44, :72; backend/src/orders/dto/guest-checkout.dto.ts:16; backend/src/orders/orders.service.ts:130; frontend/src/store/useCartStore.ts:45.

Order item arrays have no non-empty constraint, and required address strings have no non-empty or useful length constraints. Validation accepted an empty item list and blank address strings; the service's product-count check also accepts the empty case.

Conversely, the cart deliberately stores the same product in different size lines, but the backend compares the number of distinct returned products to the number of submitted lines. A cart with one shirt in two sizes fails as though a product were missing.

**Correction:** Require bounded, non-empty order lines and useful address fields. Compare unique product IDs, then independently validate and aggregate each variant line.

**Retest:** Reject empty orders, blank addresses and oversized payloads; accept one product in two legitimate sizes and multiple measurement sets under the defined business rules.

### A18 — Medium: Public products expose internal fields and archived items

**Evidence:** backend/src/products/products.controller.ts:31, :68, :74; backend/src/products/products.service.ts:283, :383, :409; backend/prisma/schema.prisma:239.

Public listing/details return full product records plus category rather than an explicit public projection. This includes costPrice when present. Detail lookups by slug or ID do not enforce isActive, despite listing excluding archived items.

**Correction:** Define a public response DTO/select allow-list that excludes cost and internal operational fields, and apply public visibility rules consistently. Preserve separate administrator reads.

**Retest:** Public list, details and recommendation endpoints must not expose cost fields; archived products should follow the documented public behavior.

### A19 — Medium: Upload validation and lifecycle are insufficient

**Evidence:** backend/src/uploads/uploads.controller.ts:43, :47, :60, :104; backend/src/main.ts:37.

Uploads trust the client-supplied MIME type. Extension handling substitutes a safe-looking suffix but does not prove the file is an image. Any authenticated account can write review-image files without demonstrating review eligibility or attaching them to a review. No per-account storage quota, orphan cleanup, or media deletion lifecycle was found.

**Correction:** Decode/re-encode supported images, bound dimensions and pixel count, enforce storage quotas and ownership, and track attachment lifecycle. Ensure persistent cloud storage and upload-volume backups are actually configured for the deployment.

**Retest:** Reject forged MIME types, malformed/oversized-dimension images and quota abuse. Confirm unattached/deleted media is cleaned without deleting active product/review assets.

### A20 — Medium: AI grounding validates only part of the output

**Evidence:** ai/app/chat.py:100, :125; ai/app/business.py:149, :180; ai/app/grounding.py:9, :53.

Customer product cards are rehydrated from database rows, but the natural-language reply is returned without equivalent fact validation. Business grounding checks numerical membership in any tool output rather than the meaning of a metric, ignores many numerical values entirely, and does not check chart series against tool outputs.

**Reproductions:** "Revenue is Rs 100" passed with actual revenue=9999 because 100 is ignored. "Revenue is Rs 500" passed when 500 was stock rather than revenue. Chart data is outside that check.

**Correction:** Render critical facts from typed tool fields, bind claims and chart series to specific source metrics, and distinguish model commentary from verified numbers. Evaluate semantic correctness, not only number presence.

**Retest:** Fabricated prices/stock in prose, swapped revenue/quantity values, ignored small numbers, and invented chart points must not be presented as verified.

### A21 — Medium: Visible features claim operations they do not perform

**Evidence:** frontend/src/app/(shop)/contact/page.tsx:19; frontend/src/components/layout/Footer.tsx:137; frontend/src/components/products/VisualSearchModal.tsx:169.

The contact form waits 700ms and displays success without sending or saving the inquiry. Newsletter submission only prevents the form's default action. Visual search displays staged vision-analysis messages, then searches product text using filename/preset keywords and falls back to the first four products; the image contents are not analyzed.

**Impact:** Customer inquiries can be lost while the customer believes they were delivered. Visual discovery and marketing claims exceed the implemented behavior.

**Correction:** Connect forms to real, observable delivery/storage or clearly mark them unavailable. Implement actual visual similarity processing or label the current capability accurately.

**Retest:** Confirm submitted inquiries reach a recorded destination. Different image content with the same filename should affect a true visual-search result.

### A22 — Medium: Readiness succeeds at HTTP level during database failure

**Evidence:** backend/src/app.controller.ts:29; ai/app/main.py:96; backend/Dockerfile:52; ai/Dockerfile:26.

Both health handlers return an object with degraded status after database failure but retain HTTP 200. The container health commands check HTTP success, so they can mark an unusable service healthy.

**Correction:** Separate liveness from readiness and return a non-success status such as 503 for unavailable required dependencies. Bound dependency probes and align infrastructure checks with readiness.

**Retest:** Disconnect the database and verify readiness, load balancing and release health fail while liveness reflects process state.

### A23 — Medium: Release gates and selected tests allow false confidence

**Evidence:** .github/workflows/ci.yml:70, :135; frontend/cypress/e2e/security.cy.ts:29, :42; frontend/cypress/e2e/payment-online.cy.ts:85, :88, :108; backend/test/guest-checkout.e2e-spec.ts:17.

CI allows lint failures and has no Python test job or dependency audit gate. The browser IDOR test can accept HTTP 200 without proving ownership and can skip its meaningful assertions if no order exists.

The PayHere browser test uses an order.totalAmount field inconsistent with the order's total contract, uses a checkout hash as the callback signature, and accepts PENDING as success. It can therefore pass while no valid payment is processed. The guest stale-tab test covers a supplied authenticated session but does not reject anonymous matching of existing privileged accounts. Several integration setups do not recreate all production bootstrap middleware.

Historical QA/security documents contain claims that conflict with current code, including strict frontend-only CORS and uniform Lax cookies.

**Correction:** Use deterministic fixtures and strict expected postconditions, share production bootstrap configuration, add the missing negative/fault-injection cases, and enforce lint, Python and dependency gates. Attach run artifacts and commit identities to audit claims.

**Retest:** Deliberately introduce the targeted defect and confirm each relevant test fails. Run all gates against a clean isolated database.

### A24 — Medium: Refund and reporting semantics can misstate finances

**Evidence:** backend/src/orders/orders.service.ts:465, :546, :554; backend/src/analytics/analytics.service.ts:157, :170; backend/prisma/migrations/20260712020000_ai_analytics_views/migration.sql:36.

Cancellation acknowledges that a refund must be issued manually but immediately marks payment REFUNDED. There is no separate record establishing refund execution. Reports that exclude refunded payments can therefore treat money as returned before it is actually returned.

AI profit views use the product's current costPrice instead of an order-line cost snapshot. Editing a product cost rewrites historical reported margin. Payment totals also assume a common currency while the installment path writes USD. Reporting day boundaries rely on the database session timezone without an explicit Sri Lankan business-time contract.

**Correction:** Introduce refund-requested/refund-completed records with amount, currency, external reference and actor; snapshot historical costs; define reporting currency and Asia/Colombo boundaries explicitly.

**Retest:** Edit current costs after a sale, request but do not execute a refund, reconcile partial receipts/refunds, and test transactions around Sri Lankan midnight.

### A25 — Medium: Low-stock filtering and availability can mislead

**Evidence:** backend/src/inventory/inventory.service.ts:215, :518, :523, :689; backend/prisma/migrations/20260712020000_ai_analytics_views/migration.sql:49.

The inventory list paginates before applying lowStockOnly, while totals still count the unfiltered set. The UI can show empty/short pages and incorrect totals while matching low-stock items exist elsewhere.

Status and alert calculations use available physical stock, while sellable stock subtracts reservations. A fully reserved product can show OK and no low-stock alert despite having no units available for new customers. Physical stock may be a valid replenishment metric, but the UI needs to distinguish it from purchasable availability.

**Correction:** Apply filtering before pagination/counting and explicitly separate on-hand, reserved, sellable and reorder-status semantics.

**Retest:** Put matching items outside the first page and reserve all remaining stock. Counts, indicators and storefront availability must remain coherent.

### A26 — Medium: Rate limiting is process-local and settings blur environments

**Evidence:** backend/src/app.module.ts:35; backend/src/auth/auth.controller.ts:29; docker-compose.yml:20, :68; backend/.env (redacted inspection).

No Redis-backed throttle storage or application Redis client was found; configuring REDIS_HOST does not provide distributed limiting. Multiple API processes therefore do not share throttle counters. A global THROTTLE_LIMIT also overrides the intended tighter authentication limit. The checked local environment sets it to 10000; this is an observed local setting, not a verified production setting.

Trusted-proxy handling is not configured in the bootstrap, which can make IP-based limits behave incorrectly behind a hosting proxy if the deployment relies on forwarded addresses.

**Correction:** Separate production/auth/AI limits, validate their bounds, use shared storage when scaling, and configure only explicitly trusted proxy hops after resolving dependency advisories.

**Retest:** Verify limits across two instances and across real proxy/client addresses, including sustained authentication and AI-budget abuse attempts.

### A27 — Medium: Durable audit and delivery records are incomplete

**Evidence:** backend/src/payments/payments.controller.ts:102; backend/src/payments/payments.service.ts:913; backend/src/production/production.service.ts:242; backend/src/products/products.controller.ts:118; backend/src/notifications/notification-dispatch.service.ts:43.

Inventory adjustments and mark-paid actions have audit records, but payment rejection does not capture an actor; product/category changes, production assignments and review moderation do not consistently create comparable business audit records. Outbound order/payment messages run after commits and errors are logged/swallowed without a durable delivery/outbox record or retry queue.

**Impact:** Important changes may be difficult to attribute, and a crash or provider failure can permanently lose customer communication.

**Correction:** Add consistent actor/entity/before/after records for critical actions and a transactional outbox with bounded retries and delivery status. Protect audit retention from ordinary destructive maintenance.

**Retest:** Attribute each privileged action to its caller. Crash after commit but before delivery and confirm messages are later delivered according to the intended duplicate policy.

### A28 — High: Private query caches survive identity changes

**Evidence:** frontend/src/hooks/use-orders.ts:15, :37; frontend/src/hooks/use-notifications.ts:8; frontend/src/app/providers.tsx:18; frontend/src/store/useAuthStore.ts:66, :76, :127.

Private order/notification queries use keys without the authenticated user's identity. The long-lived QueryClient is not cleared on logout, session expiration or account switching. Its default staleTime is 30 seconds.

**Impact:** In the same browser session, a subsequent account can receive cached data from the previous account without a new authorized request, especially during the freshness window. This is a frontend privacy issue even when backend ownership guards are correct.

**Correction:** Include identity/session scope in private query keys, cancel pending private requests, and clear private query data on logout and identity changes. Apply the same rule to worker, analytics and review-eligibility caches.

**Retest:** Sign in as account A, load private data, log out, and sign in as B without reloading the app. No A data should render, even with delayed/offline network responses.

## 6. Existing strengths to retain

| Control | Observed implementation | Assurance boundary |
| --- | --- | --- |
| Authentication by default | Global JWT guard with explicit public routes | Guest account-linking defect bypasses the intended identity boundary |
| Password storage | bcrypt at 12 rounds | Does not protect account paths that omit authentication |
| Access/refresh separation | Short access tokens; hashed random refresh tokens in DB; HttpOnly refresh cookie | Revocation, CORS and lifecycle findings remain |
| Server-side order pricing | Product prices and Decimal arithmetic determine totals | Currency and reporting contracts require correction |
| Aggregate stock protection | Guarded inventory SQL, transactions and non-negative constraints | Variant updates, metadata stock edits and cancellation races remain |
| Shared state machines | Pure order and production transition functions with unit tests | Transitions must be checked under appropriate database concurrency control |
| Error handling | Generic unexpected-error responses and structured envelopes | Not all integration tests use production bootstrap |
| Ownership checks | Customer order/payment/notification predicates and assigned-worker checks | Cached frontend data needs independent identity isolation |
| AI database design | Explicit catalog grants and PII-reduced analytics views in migrations | Runbook and deployment secrets contradict the intended isolation |
| AI tool restriction | Fixed tool allow-list and parameterized queries rather than model-generated SQL | Output truthfulness and service exposure still need work |
| Deployment hygiene | Multi-stage Node images, non-root runtime users and upload volume in Compose | Production networking, actual persistence and health behavior need verification |

## 7. Capability and non-functional assessment

| Area | Observed state | Remaining validation / action |
| --- | --- | --- |
| Catalog and categories | Substantial CRUD, archive/delete checks, search and category handling | Public data projection, variant stock, input hardening |
| Cart and custom orders | Size-specific cart lines and measurement snapshots | Accept multi-size lines; validate offered sizes; preserve intentional ready-to-wear exception |
| PayHere | Checkout signatures, callback verification and amount checks implemented | Real sandbox round trip, currency/state validation, retry/fault recovery |
| COD | Implemented for authenticated checkout | Repair guest completion and contact-verification flow |
| Installments | Schedule generation and administration scaffolding | End-to-end collection, currency, partial-payment history and truthful UI |
| Bank transfer / slip support | Referenced in documentation, templates and administrative wording | No complete dedicated bank-transfer/slip intake flow found; reconcile claimed scope |
| Factory operations | Assigned-worker tasks and stage transitions | Race tests, cancelled-order behavior, pagination for large pipelines |
| Reviews | Delivered-order eligibility and moderation code present | Media lifecycle, audit attribution and concurrency checks |
| Social publishing | Meta integration and recorded post outcomes | Actual account permissions/delivery not tested; caption generation is template-based in the inspected service |
| Customer support | Telephone/email/WhatsApp links exist | Contact/newsletter forms are not connected |
| AI shopping / BI | FTS retrieval, fixed analytical tools and forecasting implementation | Prose/chart grounding, production isolation and evaluation |
| Performance | Separate AI service, bounded queries in several paths, load scripts | No current p95/p99 claim verified; some boards/lists load unbounded records |
| Accessibility and responsive UX | Semantic controls and reusable UI components appear in source | No browser/assistive-technology audit performed; test keyboard focus, modal trapping, labels, contrast and mobile layouts |
| SEO | Root metadata, robots and sitemap provided | Product pages are client-rendered without inspected per-product metadata; root canonical inheritance and first-100-product sitemap need review |
| Media performance | Next image configuration sets unoptimized=true | Measure actual image bytes/LCP; choose safe optimized delivery and remove unnecessary local-IP permission |
| Operations | Runbook, migrations, reconciliation command, Dockerfiles and CI exist | Execute staging restore/reconcile, verify upload backups, readiness, monitoring and rollback compatibility |
| Privacy and retention | Personal/contact/address/measurement data exists | Define retention/deletion/export requirements and validate with product/legal owners; no legal compliance conclusion is made here |

## 8. Remediation roadmap

Timing below is a planning sequence, not a delivery estimate. Owners should size changes after design review.

### Immediate containment — before further public release

| Priority | Action | Suggested owner | Acceptance evidence |
| --- | --- | --- | --- |
| P0 | Close or disable unsafe guest linking/session issuance (A01) | Backend/security | Negative tests for every existing role and inactive/conflicting contacts |
| P0 | Replace wildcard tenant CORS trust; review session exposure (A03) | Backend/platform | Untrusted-origin browser tests; exact trusted origin list |
| P0 | Assess and update critical/high dependency paths (A02) | Platform/application owners | Current scans plus compatibility tests |
| P0 | Remove OTP production logging and excessive AI secrets/grants (A10, A13, A14) | Backend/platform | Redacted log tests; deployed environment/grant checks |
| P0 | Prevent cross-account cached data (A28) | Frontend | Same-browser A-to-B identity-switch test |

If the vulnerable guest path has been publicly reachable, review authentication/guest-order/admin audit evidence and determine an appropriate session invalidation and incident-response scope. This is conditional on exposure; this audit did not establish that exploitation occurred.

### Integrity and conversion — required release work

| Priority | Action | Suggested owner | Acceptance evidence |
| --- | --- | --- | --- |
| P1 | Recoverable webhook processing and payment/order reconciliation (A04, A05) | Backend/payments | Fault-injection and event-reordering tests against PostgreSQL |
| P1 | Centralize all stock writes, validate variants and serialize cancellation (A06–A09) | Backend/data | Zero drift after races, expiry and size edits |
| P1 | Complete COD/OTP and either finish or remove offered installments (A11, A12) | Frontend/backend | Real customer journeys with verified durable records |
| P1 | Central session bootstrap/rotation and input/public-response contracts (A15–A18) | Application owners | Direct reload, multi-tab, empty-input and public-field tests |
| P1 | Correct contact form behavior and financial state reporting (A21, A24) | Product/application | Delivered inquiry evidence; receipt/refund/cost reconciliation |

### Assurance and operations — before production sign-off

| Priority | Action | Suggested owner | Acceptance evidence |
| --- | --- | --- | --- |
| P1 | Make release tests fail on broken security/payment paths (A23) | QA/engineering | Mutation-style negative checks and complete CI artifacts |
| P1 | Make readiness fail during dependency outage (A22) | Platform | Deployment/readiness outage drill |
| P2 | Durable business audit and notification delivery (A27) | Backend/operations | Attributable action records and restart delivery tests |
| P2 | Upload lifecycle, AI output validation and distributed limits (A19, A20, A26) | Backend/AI/platform | Quota/content/grounding/multi-instance tests |
| P2 | Fix low-stock query semantics and verify UX/performance | Backend/frontend/QA | Correct pagination; measured representative workload |
| P2 | Replace conflicting production/security documentation | Engineering/operations | Procedures tested from a clean staging environment |

## 9. Production release acceptance criteria

Production approval should require evidence that:

1. Anonymous guest input cannot issue a session for any existing account; every role and inactive account is covered.
2. Untrusted origins cannot read refresh responses; refresh, logout, cookie and identity-switch behavior is tested on production-like domains.
3. Payment receipt, order state, stock movements and webhook processing recover correctly after any interrupted step.
4. Variant and aggregate stock remain consistent across cancellation, duplicate requests, size edits and concurrent purchases.
5. Abandoned reservations expire without losing late successful payments.
6. COD and every payment option visible in checkout has a complete, truthful, tested collection path.
7. Private frontend caches and in-flight requests are isolated by identity.
8. Current dependency findings are resolved or have documented, reviewed exposure decisions.
9. CI runs backend, frontend and Python checks with meaningful assertions; failed required gates block release.
10. Clean-database migrations, isolated integration tests, Cypress journeys and representative load tests pass with saved artifacts.
11. Actual AI grants and container secrets match the least-privilege design; OTPs and secrets are absent from production logs.
12. Readiness outage, database restore, inventory reconciliation, upload restoration and rollback procedures have been executed successfully.

## Appendix A — Reproducible evidence and command inventory

### Commands executed

~~~text
Backend:
node node_modules/jest/bin/jest.js --runInBand --no-cache
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
ESLint Node API: lintFiles(['src/**/*.ts', 'test/**/*.ts']), fix disabled
npm audit --omit=dev --json

Frontend:
node node_modules/typescript/bin/tsc --noEmit --incremental false
ESLint Node API: lintFiles(['.']), fix disabled, project ignores applied
npm audit --omit=dev --json

AI:
python -B -m pytest -p no:cacheprovider -q

Production builds:
npm --prefix backend run build
npm --prefix frontend run build
~~~

An initial frontend lint invocation explicitly named the ignored Cypress directory and was rejected by ESLint. It was corrected to lint the project using its configured ignore rules; the final reported frontend count is from that successful invocation.

### Isolated reproduction results

| Scenario | Actual local result |
| --- | --- |
| Guest checkout matching inactive, unverified ADMIN fixture | ADMIN JWT issued; existing account ID retained; one refresh session created |
| Signed webhook, simulated confirmation failure, identical retry | First call failed; retry returned duplicate=true; confirmation called only once; payment had already become COMPLETED |
| Invalid signature followed by valid event with same payment identity | Valid event returned duplicate=true; confirmation called zero times |
| Product edit with sizeStock S=10, M=20 | Product stock=30; inventory available=30; zero movement writes |
| Empty order and blank required address strings | Zero class-validator errors |
| Installment count=1000000000 | Zero class-validator errors |
| Generated revenue=100 with tool revenue=9999 | Grounding returned no fabricated values |
| Generated revenue=500 with tool revenue=9999 and stock=500 | Grounding returned no fabricated values |

These checks used actual project classes/functions with fixtures and mocks. The large installment value was validated only; no billion-row creation was attempted.

### Environment handling

Local backend/.env, frontend/.env.local and ai/.env were untracked. Secret-bearing values were inspected only through presence/placeholder metadata, not printed. No claim is made that all Git history is secret-free. The report contains no live secret values, and no credentials were tested against external providers.

### Test inventory

| Layer | Files present | Executed now |
| --- | ---: | --- |
| Backend unit specs | 16 | Yes: 163 tests passed |
| Backend integration/E2E specs | 14 | No |
| Cypress specs | 9 | No |
| Python test modules | 3 | Collection attempted; blocked by missing asyncpg |
| Load scripts | Present | No |

## Appendix B — Production build evidence

Backend build exit code: 0

~~~text

> backend@0.0.1 build
> nest build


~~~

Frontend build exit code: 0

~~~text
✓ Running next.config.ts took 5.7s

  Creating an optimized production build ...
✓ Compiled successfully in 6.0s
  Running TypeScript ...
  Finished TypeScript in 3.0s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/32) ...
  Generating static pages using 7 workers (8/32) 
  Generating static pages using 7 workers (16/32) 
npm.cmd : Sitemap notice: dynamic products not fetched during build, using static routes.
At line:35 char:25
+ ... tFrontendOutput = (& npm.cmd --prefix frontend run build 2>&1 | Out-S ...
+                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Sitemap notice:... static routes.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
  Generating static pages using 7 workers (24/32) 
✓ Generating static pages using 7 workers (32/32) in 941ms
  Finalizing page optimization ...

Route (app)                            Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ○ /account/orders
├ ƒ /account/orders/[id]
├ ƒ /account/orders/[id]/installments
├ ○ /admin
├ ○ /admin/ai-insights
├ ○ /admin/analytics
├ ○ /admin/categories
├ ○ /admin/inventory
├ ○ /admin/orders
├ ƒ /admin/orders/[id]
├ ○ /admin/payments
├ ○ /admin/production
├ ○ /admin/products
├ ○ /admin/reports
├ ○ /admin/reviews
├ ○ /apple-icon.png
├ ○ /cart
├ ○ /checkout
├ ○ /contact
├ ○ /icon.svg
├ ○ /login
├ ○ /payment/cancel
├ ○ /payment/success
├ ○ /products
├ ƒ /products/[slug]
├ ○ /register
├ ○ /returns-exchange
├ ○ /robots.txt
├ ○ /sitemap.xml                               1h      1y
├ ○ /verify
├ ○ /wishlist
├ ○ /worker
└ ○ /worker/tasks


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


~~~

## Appendix C — Primary reference sources

The findings are grounded primarily in the repository and local checks. External references were used for specific current advisory/specification claims:

- [Next.js maintainer advisory: Windows-hosted remote code execution](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- [Next.js advisory: typed-array cache function remote code execution](https://github.com/advisories/GHSA-673q-mjm6-r5xr)
- [proxy-addr maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h)
- [Multer maintainer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m)
- [OWASP CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [PayHere Checkout API and payment-notification contract](https://support.payhere.lk/api-%26-mobile-sdk/checkout-api)

**Assessment outcome:** Substantial implementation with a confirmed critical account-authentication defect and material integrity/reliability gaps. Production readiness requires remediation and the acceptance evidence above. This assessment changed no application source code or environment configuration.

</details>
