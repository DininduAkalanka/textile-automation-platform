# Nandana Textile — Security Review & Architecture Audit Report

**Date:** August 2026  
**Status:** Approved for v1.0.0 Production Release  
**Reference:** `docs/09_SECURITY_ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` (Session 10.3)

---

## 1. Executive Summary

This document certifies the security posture of the **Nandana Textile Smart Business & E-Commerce Platform**. The system was audited across seven defense-in-depth security domains: transport security, authentication, authorization (RBAC/IDOR), database safety, payment webhook verification, AI guardrails, and dependency hygiene.

---

## 2. Security Controls & Verification Evidence

### 2.1 Transport Security & HTTP Hardening
- **Helmet Headers:** Active via `helmet()` in `backend/src/main.ts`.
  - `Strict-Transport-Security` (HSTS): Enforces HTTPS connection.
  - `X-Content-Type-Options: nosniff`: Prevents MIME-type confusion attacks.
  - `X-Frame-Options: SAMEORIGIN`: Prevents clickjacking.
- **Strict CORS:** Configured in `backend/src/main.ts`. Restricted strictly to `process.env.FRONTEND_URL` with `credentials: true`. Wildcard (`*`) is prohibited.

### 2.2 Authentication & Password Security
- **Password Hashing:** `bcrypt` with work factor **12** (exceeds OWASP minimum of 10).
- **Session & Token Management:**
  - **Access Token:** Short-lived JWT stored in client memory.
  - **Refresh Token:** Stored in **`httpOnly`**, **`secure`** (in production), **`sameSite: lax`** cookie to prevent XSS exfiltration.
  - **Token Invalidation:** Revoked on logout in database and cleared via `res.clearCookie`.

### 2.3 Role-Based Access Control (RBAC) & IDOR Prevention
- **Role Verification:** `RolesGuard` decorates all `/admin` routes (`ADMIN` role required).
- **Insecure Direct Object Reference (IDOR) Defense:**
  - `GET /orders/:id`: Resolves `userId` from verified JWT token. Non-admins cannot read or cancel orders belonging to other customers (enforced at database query layer).
  - `GET /payments/:orderId`: Verifies order ownership before returning payment records.
  - `POST /reviews`: Verifies customer eligibility (must have purchased and completed order) before review creation is permitted.

### 2.4 Payment Security (PayHere & COD)
- **Zero Client-Trust Payment Model:**
  - The client **cannot** self-report or mark orders as `PAID`.
  - Orders transition to `CONFIRMED` **only** via server-to-server webhook (`/payments/payhere/notify`) verified via MD5 signature hash matching:
    $$\text{md5}(\text{merchant\_id} + \text{order\_id} + \text{amount} + \text{currency} + \text{status} + \text{md5}(\text{secret}))$$
- **Database Row Locking:** Webhook processing uses `SELECT ... FOR UPDATE` row locks to prevent race conditions during rapid webhook retries.
- **Ledger Idempotency:** Duplicate webhook calls produce identical outcomes without duplicate stock deductions.

### 2.5 AI Security, Prompt Injection & Hallucination Guardrails
- **Input Sanitization:** User prompts are capped to 500 characters and stripped of control characters before model dispatch (`chat.py`).
- **Prompt Injection Defense:** Model prompts strictly bind instructions within XML tags and instruct the LLM to refuse role-overrides.
- **Structural Hallucination Immunity (Hydrate-and-Validate):**
  - Customer AI: Model returns only a list of product IDs selected from Postgres full-text search results.
  - The backend drops any ID not in the retrieved candidate set, and re-reads prices and inventory directly from Postgres. The LLM can **never** invent a non-existent product or hallucinate a discount.
- **BI Assistant Safety:**
  - Read-only database role (`textile_ai_readonly`).
  - Strict tool whitelisting (`get_sales_summary`, `get_top_products`, etc.). The LLM **never** generates or executes arbitrary SQL queries.
  - Grounding check: Every numeric figure in the AI response is checked against raw tool output before returning.

### 2.6 Rate Limiting & Throttling
- Global `ThrottlerGuard` configured in `AppModule`:
  - Auth routes (`/auth/login`, `/auth/register`, `/auth/send-code`): **20 requests / min**.
  - AI Assistant endpoints: **10 requests / min**.
  - General API endpoints: **100 requests / min**.

---

## 3. Automated Security Verification Checklist

| Security Gate | Method | Result |
| :--- | :--- | :--- |
| **RBAC Route Wall** | Cypress E2E (`security.cy.ts`) | ✅ Passed (Unauth/Customer blocked from admin) |
| **IDOR Check** | Cypress E2E (`security.cy.ts`) | ✅ Passed (Cross-user order access denied) |
| **Stock Ledger Invariant** | CLI (`npm run reconcile`) | ✅ Passed (36 products, 0 drift) |
| **Oversell Prevention** | Jest Integration (`stock-race.e2e-spec.ts`) | ✅ Passed (Concurrent transaction locking) |
| **Webhook Burst Stress** | k6 Spike (`webhook-spike.js`) | ✅ Passed (Zero duplicate deductions) |
| **Static Code Analysis** | ESLint Typecheck | ✅ Passed (0 errors) |
| **Unit Test Coverage** | Jest (`npm test`) | ✅ Passed (16 suites, 147 tests green) |

---

## 4. Sign-Off & Release Recommendation

All controls mandated by `docs/09_SECURITY_ARCHITECTURE.md` are actively enforced and validated by automated tests. **Recommended for v1.0.0 Production Release.**
