# Smart Textile Business Management & AI-Powered E-Commerce Platform

**Nandana Textile** — An enterprise-grade, production-hardened business management and e-commerce platform engineered specifically for the Sri Lankan textile and garment manufacturing industry. The platform unifies a customer storefront, custom measurement tailoring capture, factory floor Kanban production pipeline, double-entry inventory ledger, multi-channel payment processing, and a dual-engine AI intelligence system (Retrieval-Augmented customer shopping assistant + executive business intelligence assistant).

---

[![CI](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml)
[![Cypress E2E](https://img.shields.io/badge/Cypress%20E2E-13%2F13%20Passing%20(100%25)-brightgreen.svg)](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)
[![k6 Load Tested](https://img.shields.io/badge/k6%20Load%20Tested-p95%20192ms-blue.svg)](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md)
[![Jest Unit Tests](https://img.shields.io/badge/Unit%20Tests-147%20Passing-success.svg)](backend)
[![Security Audit](https://img.shields.io/badge/Security%20Audit-OWASP%20Top%2010%20Hardened-teal.svg)](docs/SECURITY_REVIEW.md)
[![Docker Ready](https://img.shields.io/badge/Docker%20Compose-5%20Services%20Orchestrated-2496ED.svg)](docker-compose.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](frontend)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black.svg)](frontend)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E.svg)](backend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-009688.svg)](ai)

> **Academic Capstone Excellence** · Designed and engineered to strict enterprise production standards.  
> Comprehensive Documentation: [QA & Performance Report](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md) · [Production Runbook](docs/RUNBOOK.md) · [Security Review](docs/SECURITY_REVIEW.md) · [Viva Demo Script](docs/DEMO_SCRIPT.md) · [Database Architecture (DBML)](docs/database.dbml).

---

## 📑 Table of Contents

- [Core Business Capabilities](#-core-business-capabilities)
- [Dual-Engine AI Intelligence Layer](#-dual-engine-ai-intelligence-layer)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start (Docker — Recommended)](#-quick-start-docker--recommended)
- [Local Development Without Docker](#-local-development-without-docker)
- [Demo Credentials & Role Access Matrix](#-demo-credentials--role-access-matrix)
- [Service URLs & Ports](#-service-urls--ports)
- [Payment Gateway Testing (PayHere Sandbox)](#-payment-gateway-testing-payhere-sandbox)
- [Quality Assurance & Verification (Cypress & k6)](#-quality-assurance--verification-cypress--k6)
- [Production Cloud Deployment & Topology](#-production-cloud-deployment--topology)
- [Comprehensive Documentation Index](#-comprehensive-documentation-index)
- [Repository Layout](#-repository-layout)
- [Contributing & Git Workflow](#-contributing--git-workflow)

---

## 💎 Core Business Capabilities

| Feature Domain | Production Capabilities | Business Value |
| :--- | :--- | :--- |
| **Curated Storefront & UX** | High-performance catalog, multi-criteria filtering, visual search, mega navigation menu, dynamic cart, and full responsive design across mobile, tablet, and desktop viewports. Header hero swapper powered by authentic Sri Lankan lifestyle photography without promotional clutter. | Maximizes conversion, brand trust, and user engagement across devices. |
| **Bespoke Measurement Capture (BR3)** | Tailoring measurement profile module capturing precise dimensions (neck, chest, waist, hips, inseam, sleeve, height) plus custom tailoring notes. Linked directly to custom order line items. | Eliminates sizing guesswork and manual order errors for school uniforms and custom garments. |
| **Race-Safe Inventory Ledger** | Single-source-of-truth double-entry ledger with row-level locks (`SELECT FOR UPDATE`). Tracks all stock transitions: `INITIAL`, `RESERVE`, `RELEASE`, `SALE`, `PURCHASE`, `RETURN`, `ADJUSTMENT`, `PRODUCTION_USE`. | Prevents overselling during high-concurrency spikes; guarantees 100% financial and inventory consistency. |
| **Manufacturing Kanban Pipeline** | Automated stage progression: `PENDING` → `CUTTING` → `SEWING` → `FINISHING` → `QUALITY_CONTROL` → `DISPATCHED` → `COMPLETED`. Live factory worker portal (`/worker/tasks`) for task claiming and stage completion. | Complete operational visibility from customer order placement to warehouse dispatch. |
| **Zero Client-Trust Payments** | Multi-method support: **PayHere** (Visa/Mastercard/Amex with server-to-server signed MD5 webhooks), **Cash on Delivery (COD)** with phone risk validation, and **Bank Transfer / Slip Upload** with admin verification. | Eliminates payment fraud, tampering, and unpaid order dispatch. |
| **Marketing Automation** | Automated social media post generator utilizing Meta Graph API (Facebook Pages & Instagram) with AI-crafted captions, price tags, and hashtags. Native WhatsApp direct chat support. | Reduces customer acquisition costs and automates promotional workflows. |
| **Enterprise Security** | Dual-identifier auth (email or phone OTP), JWT access tokens + SHA-256 hashed refresh tokens, RBAC (`ADMIN`, `MANAGER`, `WORKER`, `CUSTOMER`), IDOR protection, and bcrypt password hashing (12 rounds). | Safeguards customer data, admin operations, and enterprise assets against OWASP Top 10 vulnerabilities. |

---

## 🧠 Dual-Engine AI Intelligence Layer

The platform features an isolated, high-performance Python FastAPI microservice (`ai/`) interfacing with Groq LLMs (`openai/gpt-oss-120b` and `llama-3.3-70b-versatile`):

```
                       ┌──────────────────────────────────────────────┐
                       │          Customer Storefront / Admin         │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │           NestJS API Gateway (:3001)         │
                       └──────────────────────┬───────────────────────┘
                                              │ Internal Service Key
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │           FastAPI AI Service (:8000)         │
                       └──────────────┬────────────────┬──────────────┘
                                      │                │
            ┌─────────────────────────┴────┐      ┌────┴───────────────────────────┐
            │ Customer Assistant (RAG)     │      │ Executive BI Assistant (Tools) │
            │ • Natural language search    │      │ • Holt-Winters demand forecast │
            │ • Fabric & styling advisor   │      │ • Inventory reorder analysis   │
            │ • Direct clickable cards     │      │ • Revenue & margin insights    │
            │ • Strict grounding filter    │      │ • Whitelisted SQL tools only   │
            └──────────────┬───────────────┘      └────┬───────────────────────────┘
                           │                           │
                           └─────────────┬─────────────┘
                                         │ SELECT ONLY (Zero PII access)
                                         ▼
                       ┌──────────────────────────────────────────────┐
                       │  PostgreSQL 16 (textile_ai_readonly role)    │
                       └──────────────────────────────────────────────┘
```

1. **Customer Shopping Assistant (RAG Retrieval)**:
   - Understands customer fabric queries (e.g., *"What is the best breathable cotton for school uniforms in warm weather?"*).
   - Performs semantic and full-text retrieval across active product catalogs.
   - Renders interactive, clickable product cards directly inside the chat interface.
   - Enforces strict anti-hallucination verification (`grounding.py`): ensures prices, SKUs, and stock quantities correspond strictly to the live database.
2. **Executive Business Intelligence (BI) Assistant**:
   - Whitelisted tool-calling execution for administrators and managers.
   - Calculates inventory velocity, stockout risks, and revenue run-rates.
   - Generates sales demand forecasts utilizing Holt-Winters exponential smoothing via `statsmodels`.
3. **Architectural Isolation & Security**:
   - Runs in a dedicated container to prevent compute-heavy LLM calls or model latency from blocking the main API event loop.
   - Connects to PostgreSQL via a dedicated **read-only database role** (`textile_ai_readonly`): cannot mutate data, cannot view customer passwords, tokens, or PII.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────────────────────┐
                               │           Next.js 16 Storefront          │
                               │        (Customer, Admin, Worker)         │
                               └────────────────────┬─────────────────────┘
                                                    │
                                         HTTPS / REST API (:3001)
                                                    │
                                                    ▼
                               ┌──────────────────────────────────────────┐
                               │           NestJS 11 REST API             │
                               │   Auth · Orders · Payments · Production  │
                               └───────┬─────────────────┬────────┬───────┘
                                       │                 │        │
                   Internal HTTP (:8000)│    Prisma ORM   │        │
                                       ▼                 ▼        ▼
                      ┌──────────────────────┐  ┌──────────────┐ ┌──────────────┐
                      │  FastAPI AI Service  │  │  PostgreSQL  │ │   Redis 7    │
                      │  RAG & Forecasting   │  │  Database    │ │  Cache/Rate  │
                      └──────────┬───────────┘  │   (:5433)    │ │   Limiting   │
                                 │              └──────────────┘ └──────────────┘
                                 │ Read-Only           ▲
                                 └─────────────────────┘
```

### Architectural Principles:
- **Single Database Writer**: The NestJS API is the sole mutating service in the entire topology.
- **Transactional Ledger**: Stock movements utilize database transactions with row-level locks, guaranteeing zero race conditions during simultaneous customer purchases.
- **Zero Client-Trust Checkout**: Payment state transitions occur exclusively through verified server-to-server webhooks signed with cryptographic hashes.

---

## 🛠️ Technology Stack

| Layer | Technologies | Key Libraries & Frameworks |
| :--- | :--- | :--- |
| **Frontend** | TypeScript 5, React 19, Next.js 16 (App Router) | Tailwind CSS, Vanilla CSS Tokens, Zustand, TanStack Query, Recharts, Lucide Icons |
| **Backend API** | TypeScript 5, Node.js 20+, NestJS 11 | Prisma ORM 6, class-validator, Passport.js (JWT), bcrypt (12 rounds), Resend Email |
| **AI Microservice** | Python 3.12, FastAPI, Uvicorn | Groq API Client, statsmodels (Holt-Winters), asyncpg, Pydantic v2 |
| **Database & Caching** | PostgreSQL 16 (Alpine), Redis 7 (Alpine) | Connection pooling, double-entry ledger, read-only AI role, Redis rate-limiting |
| **Payment Gateway** | PayHere Payment Gateway, Stripe (Mock) | Server-to-server MD5 webhook verification, sandbox test suites |
| **Testing & QA** | Cypress 15 (Headless E2E), Grafana k6, Jest | Electron headless test runner, concurrent load testing, service unit tests |
| **DevOps & Containers**| Docker, Docker Compose, GitHub Actions CI | Multi-stage non-root Alpine images, automated migrations, health check probes |

---

## 📋 Prerequisites

- **Docker Desktop** (version 24.0 or newer) — Recommended for single-command orchestration.
- **Node.js 20+** and **npm 10+** (if developing locally without Docker).
- **Python 3.11 or 3.12** (if developing the AI service locally without Docker).
- **PostgreSQL 16** (if hosting a local database without Docker).
- **Git**.

---

## 🚀 Quick Start (Docker — Recommended)

Start the entire platform (PostgreSQL, Redis, NestJS Backend, FastAPI AI, and Next.js Frontend) in isolated containers with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/DininduAkalanka/textile-automation-platform.git
cd textile-automation-platform

# 2. Prepare environment configuration
cp backend/.env.example backend/.env

# 3. Build and launch all 5 microservices
docker compose up -d --build
```

The database migrations and initial seed catalogue will be applied automatically during boot.

### Verify Running Containers:
```bash
docker compose ps
```
You should see all 5 containers active and healthy:
- `textile_frontend` (`http://localhost:3000`)
- `textile_backend` (`http://localhost:3001/api/v1`)
- `textile_ai` (`http://localhost:8000`)
- `textile_postgresdocker` (`localhost:5433`)
- `textile_redis` (`localhost:6379`)

---

## 💻 Local Development Without Docker

If you prefer to run services natively on your host machine:

### 1. PostgreSQL Database & Migrations
```bash
cd backend
npm install
cp .env.example .env
# Ensure PostgreSQL is running on port 5432 (or 5433) and update DATABASE_URL in .env
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

### 2. FastAPI AI Service
```bash
cd ai
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 👥 Demo Credentials & Role Access Matrix

The database is pre-seeded with sample data and test accounts for every business role:

| Role | Email Address | Password | Accessible Portals & Features |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@textileshop.com` | `Admin@123456` | Full administrative access: Dashboard metrics, Inventory Ledger, Kanban Production, Orders, AI Insights, User Management. |
| **Customer** | `customer@example.com` | `Customer@123456` | Customer Storefront: Catalog browsing, Bespoke Measurements profile, Cart, PayHere/COD Checkout, Order Tracking. |
| **Worker (Cutting)** | `worker1@textileshop.com` | `Worker@123456` | Factory Worker Portal (`/worker/tasks`): Cutting stage claiming, progress logging, and stage completion. |
| **Worker (Stitching)** | `worker2@textileshop.com` | `Worker@123456` | Factory Worker Portal (`/worker/tasks`): Sewing & Stitching stage claiming, progress logging, and stage completion. |

---

## 🌐 Service URLs & Ports

| Service Component | URL / Port | Description |
| :--- | :--- | :--- |
| **Customer Storefront & Admin** | `http://localhost:3000` | Next.js 16 Web Application (Storefront, Admin, Worker Portal) |
| **Backend REST API** | `http://localhost:3001/api/v1` | NestJS REST API root & health checks |
| **Interactive Swagger API Docs** | `http://localhost:3001/api/v1/docs` | OpenAPI documentation with interactive sandbox |
| **AI Microservice & Health** | `http://localhost:8000/health` | FastAPI RAG, BI tool execution, and forecasting engine |
| **PostgreSQL Database** | `localhost:5433` (Docker mapped) | Primary relational database (`textile_db`) |
| **Redis In-Memory Store** | `localhost:6379` | Cache layer, queue broker, and rate limiting |

---

## 💳 Payment Gateway Testing (PayHere Sandbox)

The platform includes integration with Sri Lanka's **PayHere** payment gateway:

1. Sign in as a customer (`customer@example.com` / `Customer@123456`).
2. Add products to your cart and proceed to `/checkout`.
3. Select **Card / PayHere Payment Gateway**.
4. Use the PayHere Sandbox test credentials:
   - **Test Visa Card**: `4916217501611292` (Expiry: Any future date, CVV: `123`, OTP: `123456`)
   - **Test Mastercard**: `5307732125531191`
5. Upon successful authorization, PayHere issues an asynchronous server-to-server webhook to `/api/v1/payments/payhere/notify`.
6. The backend verifies the MD5 signature hash:
   $$\text{Hash} = \text{MD5}(\text{MerchantID} + \text{OrderID} + \text{Amount} + \text{Currency} + \text{StatusCode} + \text{MD5}(\text{MerchantSecret}))$$
7. When verified, stock reservations convert into confirmed sales in the inventory ledger and the order transitions to `CONFIRMED`.

---

## 🧪 Quality Assurance & Verification (Cypress & k6)

The repository implements a comprehensive testing pyramid verified via continuous integration. Full test logs and metrics are documented in [`docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md`](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md).

### 1. Cypress Headless End-to-End Test Suite (13/13 Passed — 100%)

Executes full browser automation across five core business journeys:

```bash
# Run headless (CI mode)
cd frontend
npm run test:e2e

# Run interactive visual runner
npm run test:e2e:open
```

| Test Specification | Covered Business Flows | Tests | Status |
| :--- | :--- | :---: | :---: |
| `admin-operations.cy.ts` | Executive Dashboard metrics, Orders management, Production Kanban, Inventory Ledger | 4 / 4 | ✅ 100% Passed |
| `ai.cy.ts` | Customer Shopping Assistant (RAG chat) & Admin Business Intelligence insights | 2 / 2 | ✅ 100% Passed |
| `customer-journey.cy.ts` | Customer registration, Catalog search, Cart state, Bespoke measurements, COD checkout | 3 / 3 | ✅ 100% Passed |
| `payment-online.cy.ts` | PayHere card checkout simulation & idempotent server-to-server webhook verification | 1 / 1 | ✅ 100% Passed |
| `security.cy.ts` | Route guards, RBAC enforcement across 4 roles, and IDOR defense validation | 3 / 3 | ✅ 100% Passed |

### 2. Grafana k6 Load & Concurrency Stress Testing

Audits non-functional requirement **NFR-001** (response times < 2000ms under load) and payment webhook burst resilience:

```bash
# Simulate 100 concurrent shopping customer sessions
docker run --rm -i -v "${PWD}/scripts/load:/scripts" -e API_URL=http://host.docker.internal:3001/api/v1 grafana/k6 run /scripts/scenarios.js

# Stress test 100 simultaneous signed payment webhook bursts
docker run --rm -i -v "${PWD}/scripts/load:/scripts" -e API_URL=http://host.docker.internal:3001/api/v1 grafana/k6 run /scripts/webhook-spike.js
```

- **NFR-001 Performance Benchmark**: Achieved `p(95) = 192ms` under 100 concurrent users (Target: < 2000ms — **10x faster than requirement**).
- **Webhook Spike Throughput**: Sustained **262 requests/second** with **0.00% failure rate** and zero database locking deadlocks.

### 3. Backend Unit & Ledger Reconcile Tests (Jest)

```bash
cd backend
# Run 16 test suites covering 147 unit tests
npm test

# Verify inventory ledger double-entry mathematical balance
npm run reconcile
```

---

## ☁️ Production Cloud Deployment & Topology

```
                       ┌─────────────────────────────────────────┐
                       │            Vercel Edge CDN              │
                       │         (Next.js 16 Storefront)         │
                       └────────────────────┬────────────────────┘
                                            │
                                 HTTPS / REST API
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │          Railway / Render API           │
                       │           (NestJS 11 Backend)           │
                       └───────┬─────────────────────────┬───────┘
                               │                         │
                      Internal gRPC / HTTP        PostgreSQL TCP
                               │                         │
                               ▼                         ▼
 ┌───────────────────────────────────────┐   ┌───────────────────────────────────┐
 │          Railway / Render AI          │   │      Neon / Supabase Postgres     │
 │       (FastAPI / RAG / Forecast)      ├───┤  (Pooled DB + Read-Only AI Role)  │
 └───────────────────────────────────────┘   └───────────────────────────────────┘
```

Detailed deployment blueprints, secret rotation procedures, and rollback strategies are documented in [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

### Recommended Production Environment Configuration:

#### Backend API (`Railway` / `Render`)
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@ep-pooler.neon.tech/textile_db?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-direct.neon.tech/textile_db?sslmode=require
FRONTEND_URL=https://nandanatextile.lk
JWT_SECRET=your_32_byte_cryptographic_secret
JWT_EXPIRATION=7d
INTERNAL_API_KEY=your_shared_internal_service_key
AI_SERVICE_URL=https://ai.nandanatextile.lk
AI_TIMEOUT_MS=30000
PAYHERE_MERCHANT_ID=your_live_merchant_id
PAYHERE_MERCHANT_SECRET=your_live_merchant_secret
PAYHERE_MODE=live
PAYHERE_NOTIFY_URL=https://api.nandanatextile.lk/api/v1/payments/payhere/notify
```

#### AI Microservice (`Railway` / `Render`)
```env
PORT=8000
DATABASE_URL_READONLY=postgresql://textile_ai_readonly:secure_pass@ep-direct.neon.tech/textile_db?sslmode=require
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-120b
LLM_API_KEY=gsk_your_groq_production_key
INTERNAL_API_KEY=your_shared_internal_service_key
```

#### Storefront Web App (`Vercel`)
```env
NEXT_PUBLIC_API_URL=https://api.nandanatextile.lk/api/v1
```

---

## 📖 Comprehensive Documentation Index

All architectural specifications, designs, and operational runbooks are maintained in the [`docs/`](docs/) directory:

| Document | File Link | Summary & Contents |
| :--- | :--- | :--- |
| **00 — Project Vision** | [`docs/00_PROJECT_VISION.md.txt`](docs/00_PROJECT_VISION.md.txt) | Problem statement, Sri Lankan industry context, business drivers, target personas. |
| **01 — Business Requirements** | [`docs/01_BUSINESS_REQUIREMENTS.md.txt`](docs/01_BUSINESS_REQUIREMENTS.md.txt) | Comprehensive BR1 to BR8 business requirements matrix and acceptance criteria. |
| **02 — System Scope** | [`docs/02_SYSTEM_SCOPE.md.txt`](docs/02_SYSTEM_SCOPE.md.txt) | In-scope modules, out-of-scope boundaries, user roles, system boundaries. |
| **03 — Software Requirements (SRS)** | [`docs/03_SOFTWARE_REQUIREMENTS_SPECIFICATION.md.txt`](docs/03_SOFTWARE_REQUIREMENTS_SPECIFICATION.md.txt) | Functional and non-functional requirements (NFRs), constraints, standards. |
| **04 — System Architecture** | [`docs/04_SYSTEM_ARCHITECTURE.md.txt`](docs/04_SYSTEM_ARCHITECTURE.md.txt) | High-level modular monolithic to microservices architecture, data flow diagrams. |
| **05 — Technology Stack** | [`docs/05_TECHNOLOGY_STACK.md.txt`](docs/05_TECHNOLOGY_STACK.md.txt) | Technology justification, trade-offs, language choices, runtime versions. |
| **06 — Database Design** | [`docs/06_DATABASE_DESIGN.md.txt`](docs/06_DATABASE_DESIGN.md.txt) | Relational schema, normalization, indexes, movement ledger design. |
| **07 — API Design & Contract** | [`docs/07_API_DESIGN.md.txt`](docs/07_API_DESIGN.md.txt) | RESTful API guidelines, status codes, response wrapping, error handling. |
| **08 — AI Integration Design** | [`docs/08_AI_INTEGRATION_DESIGN.md.txt`](docs/08_AI_INTEGRATION_DESIGN.md.txt) | Dual RAG architecture, vector search, grounding filter, tool execution schema. |
| **09 — Security Architecture** | [`docs/09_SECURITY_ARCHITECTURE.md.txt`](docs/09_SECURITY_ARCHITECTURE.md.txt) | Authentication, authorization, token rotation, OWASP Top 10 defense. |
| **10 — UI/UX Design System** | [`docs/10_UI_UX_GUIDELINES.md.txt`](docs/10_UI_UX_GUIDELINES.md.txt) | Design tokens, color palette, typography hierarchy, responsive breakpoints. |
| **11 — Payment Integration** | [`docs/11_PAYMENT_INTEGRATION.md.txt`](docs/11_PAYMENT_INTEGRATION.md.txt) | PayHere integration, MD5 webhook verification, COD and installment workflows. |
| **12 — Deployment Architecture** | [`docs/12_DEPLOYMENT_ARCHITECTURE.md.txt`](docs/12_DEPLOYMENT_ARCHITECTURE.md.txt) | Containerization, cloud topology, edge delivery, environment staging. |
| **13 — Testing Strategy** | [`docs/13_TESTING_STRATEGY.md.txt`](docs/13_TESTING_STRATEGY.md.txt) | Testing pyramid: unit, integration, E2E browser automation, k6 load testing. |
| **Production Runbook** | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Operations manual, deployment checklists, backup/restore drills, incident recovery. |
| **Security Review** | [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) | Formal security audit, threat modeling, pen-test verification. |
| **QA & Performance Report** | [`docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md`](docs/QA_TEST_REPORT_E2E_AND_PERFORMANCE.md) | Official test execution logs, timings, Cypress passes, k6 graphs. |
| **Database Schema (DBML)** | [`docs/database.dbml`](docs/database.dbml) | DBML schema definition renderable visually at [dbdiagram.io](https://dbdiagram.io/d). |
| **Viva Demo Walkthrough** | [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | 10-minute structured presentation script for university examiners and stakeholders. |

---

## 📁 Repository Layout

```
.
├── backend/                       # NestJS 11 REST API Microservice
│   ├── src/
│   │   ├── auth/                  # JWT auth, dual-identifier OTP, guards, RBAC
│   │   ├── orders/                # Checkout state machine, order life cycle
│   │   ├── payments/              # PayHere gateway & signed webhook validation
│   │   ├── inventory/             # Double-entry movement ledger & row-level locking
│   │   ├── production/            # Manufacturing Kanban task management
│   │   ├── analytics/             # Revenue reporting & BI export
│   │   └── social/                # Meta Graph API (Facebook/IG) auto-posting
│   ├── prisma/                    # Schema definition, migrations, and seed scripts
│   └── test/                      # Unit & service integration test suites (Jest)
├── frontend/                      # Next.js 16 Web Application (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (shop)/            # Customer Storefront (Hero swapper, Catalog, Cart)
│   │   │   ├── (admin)/           # Admin Operations Dashboard & Analytics
│   │   │   ├── (worker)/          # Factory Worker Task Portal
│   │   │   └── (auth)/            # Login, Registration, OTP verification
│   │   ├── components/            # Reusable UI components, modals, navigation
│   │   └── lib/                   # API client, state stores (Zustand), utilities
│   └── cypress/                   # Automated E2E test specifications & fixtures
├── ai/                            # FastAPI AI & Machine Learning Microservice
│   ├── app/
│   │   ├── main.py                # FastAPI endpoints & CORS configuration
│   │   ├── rag.py                 # Retrieval-grounded customer shopping assistant
│   │   ├── bi.py                  # Executive tool execution & database analysis
│   │   ├── forecast.py            # Holt-Winters exponential smoothing demand model
│   │   └── grounding.py           # Anti-hallucination validation filter
│   └── requirements.txt           # Python dependencies (statsmodels, asyncpg, etc.)
├── scripts/
│   └── load/                      # Grafana k6 load & concurrency test scripts
├── docs/                          # Architecture specs (00–13), Runbook, QA reports
├── docker-compose.yml             # 5-container orchestration configuration
└── README.md                      # Primary project documentation
```

---

## 🤝 Contributing & Git Workflow

The `main` branch is protected and always deployable to staging and production. All updates follow conventional commits and branch pull requests:

```bash
# Create a feature or fix branch
git checkout -b feat/your-feature-name

# Stage and commit your changes
git add .
git commit -m "feat(storefront): description of changes"

# Push to your feature branch
git push -u origin feat/your-feature-name
```

*Continuous Integration (GitHub Actions) runs backend TypeScript builds, unit test suites, and Cypress headless end-to-end browser specifications automatically on every pull request.*

---

## 📜 Academic Capstone Declaration

This project was engineered as an **Honours Degree Final-Year Capstone Project** addressing automated supply chain management, bespoke tailoring workflows, and grounded artificial intelligence in the Sri Lankan apparel retail sector.

**Author:** Dinindu Akalanka  
**Institution:** Sri Lanka Institute of Information Technology (SLIIT)  
**Project Title:** Smart Textile Business Management & E-Commerce Platform with AI Intelligence