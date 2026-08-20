# Smart Textile Business Management & AI-Powered E-Commerce Platform

**Nandana Textile** — a full-stack, production-hardened platform for a Sri Lankan textile retailer and uniform manufacturer: a customer storefront, an admin operations dashboard, a factory worker portal, multi-method payments, a race-safe inventory ledger, production tracking, and a dual AI layer (a retrieval-grounded shopping assistant + an owner business-intelligence assistant).

[![CI](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml)
[![Cypress E2E](https://img.shields.io/badge/Cypress%20E2E-13%2F13%20Passing-brightgreen.svg)](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)
[![k6 Load Tested](https://img.shields.io/badge/k6%20Load%20Tested-p95%20192ms-blue.svg)](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)
[![Tests](https://img.shields.io/badge/Unit%20Tests-147%20Passing-success.svg)](backend)
[![Security Review](https://img.shields.io/badge/Security%20Audit-Passed%20(OWASP%20Hardened)-teal.svg)](docs/SECURITY_REVIEW.md)

> **University Final-Year Capstone Project** · Built to production standards.  
> Detailed specifications: [QA & Performance Report](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md) · [Production Runbook](docs/RUNBOOK.md) · [Security Review](docs/SECURITY_REVIEW.md) · [Viva Demo Script](docs/DEMO_SCRIPT.md).

---

## 📑 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker — Recommended)](#quick-start-docker--recommended)
- [Demo Accounts](#demo-accounts)
- [Service URLs & Ports](#service-urls--ports)
- [Testing PayHere Payments (Sandbox)](#testing-payhere-payments-sandbox)
- [Testing Suite & Verification (Cypress & k6)](#testing-suite--verification-cypress--k6)
- [Production Runbook & Security Posture](#production-runbook--security-posture)
- [Project Structure](#project-structure)
- [Contributing (Git Workflow)](#contributing-git-workflow)

---

## ✨ Features

| Area | What it does |
|---|---|
| **Storefront** | Browse/search catalogue, product details, bespoke measurement capture (BR3), AI shopping assistant |
| **Checkout & Payments** | Server-recomputed totals, race-safe stock reservation, **PayHere** (Card/Webhook), **Cash on Delivery (COD)**, Bank Transfer |
| **Inventory** | Single-source-of-truth **movement ledger** (reserve → sell → release), row locks (`SELECT FOR UPDATE`), low-stock alerts |
| **Production** | Auto-created Kanban stages (Cutting → Sewing → Finishing → QC), worker task portal, order auto-advance |
| **Order Management** | Full lifecycle tracking stepper, customer tracking timeline, admin operations & invoice generation |
| **Dashboard & Analytics** | Revenue/orders metrics, **demand forecasting** (Holt-Winters), reorder suggestions, CSV export |
| **AI Intelligence** | Customer assistant (retrieval-grounded RAG) + owner assistant (whitelisted tool-calling with `grounding.py` anti-hallucination) |
| **Marketing** | Auto-generate social captions and post to **Facebook/Instagram** (Meta Graph API) or share to WhatsApp |
| **Accounts & Security** | Dual identity (email/phone), OTP verification, JWT auth with hashed refresh tokens, RBAC & IDOR defense |

---

## 🛠️ Tech Stack

- **Frontend** — Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS · Zustand · TanStack Query · Recharts · Lucide Icons
- **Backend** — NestJS 11 · TypeScript · Prisma ORM 6 · PostgreSQL 16 · class-validator · Jest · Supertest
- **AI Microservice** — Python 3.11 · FastAPI · statsmodels (forecasting) · asyncpg · Pydantic
- **Testing & Tooling** — Cypress 15.20 (Electron Headless E2E) · Grafana k6 (Load & Spike testing)
- **Infrastructure** — Multi-stage non-root Dockerfiles · Docker Compose · Redis 7 · GitHub Actions CI

---

## 🏗️ System Architecture

```
                 ┌─────────────────────────┐
   Browser  ───▶ │  Next.js 16 (frontend)   │  :3000
                 └───────────┬─────────────┘
                             │  REST /api/v1
                 ┌───────────▼─────────────┐        ┌──────────────────┐
                 │  NestJS API (backend)    │ :3001  │ FastAPI AI service│ :8000
                 │  auth · orders · payments │◀──────▶│  RAG chat · ML    │
                 │  inventory · production   │ internal│  forecasting      │
                 └───────┬───────────┬──────┘        └────────┬─────────┘
                         │           │                        │ read-only role
                 ┌───────▼──┐   ┌────▼────┐          ┌────────▼─────────┐
                 │ Redis 7  │   │ PayHere │          │  PostgreSQL 16   │ :5433
                 │ (opt.)   │   │ sandbox │          │  (single DB)     │
                 └──────────┘   └─────────┘          └──────────────────┘
```

* **Single Database Writer:** The NestJS API is the sole writer to the database.
* **AI Security Isolation:** The AI service connects via a dedicated, PII-free, read-only PostgreSQL role (`textile_ai_readonly`).
* **Payment Zero Client-Trust:** Orders transition to confirmed states solely via server-to-server signed MD5 webhooks.

---

## 📋 Prerequisites

- **Docker Desktop** (Recommended path — starts the complete platform in isolated containers)
- **Node.js 20+** and **Python 3.11+** and a local **PostgreSQL 16** (if running without Docker)
- Git

---

## 🚀 Quick Start (Docker — Recommended)

```powershell
# 1. Clone the repository
git clone https://github.com/DininduAkalanka/textile-automation-platform.git
cd textile-automation-platform

# 2. Configure backend environment
cp backend/.env.example backend/.env

# 3. Build & start all 5 containers
docker compose up -d --build
```

On startup, database migrations are applied automatically. The production backend container runs as a non-root `node` user (uid 1000) using multi-stage builds.

---

## 👥 Demo Accounts

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin@textileshop.com` | `Admin@123456` | Full administrative control, inventory ledger, Kanban production, AI Insights |
| **Customer** | `customer@example.com` | `Customer@123456` | Storefront, cart, bespoke measurement profile, order tracking |
| **Worker (Cutting)** | `worker1@textileshop.com` | `Worker@123456` | Factory floor worker portal (`/worker/tasks`) — Cutting stage |
| **Worker (Stitching)**| `worker2@textileshop.com` | `Worker@123456` | Factory floor worker portal (`/worker/tasks`) — Sewing stage |

---

## 🌐 Service URLs & Ports

| Service | URL | Description |
|---|---|---|
| **Storefront & Admin** | `http://localhost:3000` | Next.js 16 Web Application |
| **Backend REST API** | `http://localhost:3001/api/v1` | NestJS API & Health Check |
| **Swagger API Docs** | `http://localhost:3001/api/v1/docs` | Interactive OpenAPI documentation |
| **AI Microservice** | `http://localhost:8000` | FastAPI RAG & Forecasting Service |
| **PostgreSQL Database**| `localhost:5433` | PostgreSQL 16 (user: `postgres`, db: `textile_db`) |
| **Redis Cache** | `localhost:6379` | In-memory cache & rate limiter |

---

## 💳 Testing PayHere Payments (Sandbox)

The platform supports Sri Lankan PayHere payment gateway checkout and webhook handling:

1. **Log in as customer** and add items to your cart.
2. At checkout, select **Online Payment / Card (PayHere)**.
3. Use a sandbox test card on the payment modal:
   * **Visa**: `4916217501611292` (Expiry: Future date, CVV: `123`, OTP: `123456`)
   * **Mastercard**: `5307732125531191`
4. After authorization, the webhook automatically confirms the order, marks the payment as completed, and allocates stock in the inventory ledger.

---

## 🧪 Testing Suite & Verification (Cypress & k6)

The platform includes a comprehensive, multi-layer testing pyramid. Full report: **[`docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md`](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)**.

### 1. Cypress Headless End-to-End Suite (13/13 Passed — 100%)
Runs automated browser testing across all 5 core user and business flows:

```powershell
# Run headless (CI equivalent)
cd frontend
npm run test:e2e

# Run interactive visual runner
npm run test:e2e:open
```

| Spec | Coverage | Tests | Pass Rate |
| :--- | :--- | :---: | :---: |
| `admin-operations.cy.ts` | Dashboard Metrics, Orders Table, Kanban Pipeline, Inventory Ledger | 4 / 4 | ✅ 100% |
| `ai.cy.ts` | Customer Shopping Assistant (RAG) & Admin AI Insights | 2 / 2 | ✅ 100% |
| `customer-journey.cy.ts` | Dynamic Registration, Catalog Browse, Cart & COD Checkout | 3 / 3 | ✅ 100% |
| `payment-online.cy.ts` | Card Checkout & Idempotent Server-to-Server Webhook | 1 / 1 | ✅ 100% |
| `security.cy.ts` | Protected Route Guards, RBAC Enforcement & IDOR Defense | 3 / 3 | ✅ 100% |

### 2. Grafana k6 Load & Concurrency Performance
Audits Non-Functional Requirement **NFR-001** (response time < 2000ms under load) and payment webhook burst resilience:

```powershell
# Run 100 concurrent user shopping traffic simulation
docker run --rm -i -v "${PWD}/scripts/load:/scripts" -e API_URL=http://host.docker.internal:3001/api/v1 grafana/k6 run /scripts/scenarios.js

# Run 100 simultaneous signed payment webhook burst test
docker run --rm -i -v "${PWD}/scripts/load:/scripts" -e API_URL=http://host.docker.internal:3001/api/v1 grafana/k6 run /scripts/webhook-spike.js
```

* **NFR-001 Benchmark**: `p(95) = 192ms` (Requirement: < 2000ms — **10x faster than target**)
* **Webhook Spike Throughput**: **262 req/sec**, 0.00% failure rate, 100% database row lock safety.

### 3. Backend Unit & Service Integration Tests (Jest)
```powershell
cd backend
npm test               # 16 test suites, 147 unit tests (100% pass)
npm run reconcile      # Verify inventory ledger double-entry consistency
```

---

## 📖 Documentation & Runbooks

- 📊 **[QA & Performance Test Report](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)** — Complete test inventory, Cypress execution timings, and k6 benchmark graphs.
- 🚀 **[Production Runbook](docs/RUNBOOK.md)** — Topology, environment matrix, deployment instructions (Vercel + Railway/Render + Supabase), secret rotation, and backup drills.
- 🛡️ **[Security Architecture Review](docs/SECURITY_REVIEW.md)** — OWASP Top 10 defenses, bcrypt-12, httpOnly cookies, IDOR protection, and AI grounding guardrails.
- 🎤 **[10-Minute Viva Demo Script](docs/DEMO_SCRIPT.md)** — Evaluator walkthrough covering storefront, custom measurements, factory pipeline, and AI business intelligence.
- 🗄️ **[Database Design & DBML](docs/database.dbml)** — Visual schema and entity-relationship definitions. Render at [dbdiagram.io/d](https://dbdiagram.io/d).

---

## 📁 Project Structure

```
.
├── backend/            NestJS 11 REST API
│   ├── src/            Auth, Orders, Payments, Inventory, Production, Analytics, Social
│   ├── prisma/         Prisma 6 schema, migrations, and seed scripts
│   └── test/           Integration and race-condition test suites
├── frontend/           Next.js 16 Web Application
│   ├── src/app/        (shop) Storefront · (admin) Dashboard · worker Portal · (auth)
│   └── cypress/        Cypress 15 E2E test specs (Admin, AI, Journey, Payment, Security)
├── ai/                 FastAPI AI Microservice (Python 3.11)
│   └── app/            RAG shopping chat, Holt-Winters forecasting, BI tool-calling
├── scripts/            
│   └── load/           k6 load testing scripts (scenarios.js, webhook-spike.js)
├── docs/               System designs (00–13), RUNBOOK, SECURITY_REVIEW, DEMO_SCRIPT
├── docker-compose.yml  5-service local orchestration
└── IMPLEMENTATION_PLAN.md Authoritative build specification
```

---

## 🤝 Contributing (Git Workflow)

`main` is protected and always deployable. All contributions follow conventional commits and branch pull requests:

```powershell
git checkout -b fix/your-feature-name
git add -u
git commit -m "feat(module): description of changes"
git push -u origin fix/your-feature-name
```
*GitHub Actions automatically runs backend tests, TypeScript builds, and headless Cypress E2E specs on every pull request.*

---

*Academic Capstone Project — Nandana Textile Automation Platform.*
