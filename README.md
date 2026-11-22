# Nandana Textile — Commerce & Operations Platform

The online shop and back office of **Nandana Textile**, a textile, apparel and uniform retailer in Veyangoda, Sri Lanka. One platform runs the customer storefront, made-to-measure ordering, payments, the production floor, stock, and business reporting, with an AI shopping assistant for customers and an AI analyst for the owner.

[![CI](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml)
[![Playwright nightly](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/playwright-nightly.yml/badge.svg?branch=main)](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/playwright-nightly.yml)

**Live site:** [www.nandanatextile.lk](https://www.nandanatextile.lk) · **Operations:** [Runbook](docs/RUNBOOK.md) · **Shop owners:** [Admin guide](docs/ADMIN_GUIDE.md) · **Launch:** [Go-live checklist](docs/GO_LIVE_CHECKLIST.md)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Storefront (customers)

- **Catalogue** with categories, search, filters, size guide and per-size stock.
- **Made-to-measure** ordering: customers enter measurements per item (fields depend on the garment type), which reach the tailor on the production board.
- **Checkout** by PayHere card payment, cash on delivery, or 3 monthly instalments; guest checkout with email verification.
- **Accounts** with email or phone verification codes, password reset by email link, show/hide password, editable name.
- **Orders**: tracking timeline, PDF invoice, retry for an unpaid card payment, cancellation while pending.
- **Reviews** with photos, ratings and "helpful" votes; **wishlist**; **WhatsApp** contact.
- **AI shopping assistant** that suggests products from the live catalogue only (it cannot invent products or prices).

### Back office (admin)

- **Dashboard**: revenue, paid orders, payments awaiting, low stock, recent orders.
- **Products and categories**, with photo uploads stored in Cloudinary; archive and restore.
- **Inventory ledger**: every stock change is a recorded movement (reservation, release, sale, adjustment); reorder levels and low-stock alerts.
- **Order processing**: confirm → fulfil → deliver → cash collected; admin cancellation releases stock.
- **Payments and instalments**: record cash or bank payments, view schedules.
- **Production board**: Cutting → Stitching → Finishing → Quality Check, with a separate **worker portal** where staff start, complete and pass work.
- **Reviews moderation**, **CSV reports** (sales, inventory), **analytics** (demand forecast, trending, slow movers, reorder suggestions) and **AI business insights** answered only from the shop's own figures.
- **Social sharing**: ready-made captions, WhatsApp share, and Facebook/Instagram posting when a Meta token is configured.

### Platform

- **Security**: short-lived access tokens with rotating refresh cookies and reuse detection, role-based access (admin, worker, customer), account lockout, rate limiting, strict CORS, security headers, signed payment verification.
- **SEO**: per-page titles and canonical URLs, sitemap and robots.txt, Product, Breadcrumb and ClothingStore structured data.
- **Notifications**: in-app notifications and transactional email (verification, receipts with invoice, order alerts); optional SMS.

---

## Architecture

```mermaid
flowchart LR
    U["Customers & staff<br/>(browser)"] --> W["Storefront & admin<br/>Next.js · Vercel"]
    W -->|"REST /api/v1"| A["API<br/>NestJS · Render"]
    A --> D[("PostgreSQL 16<br/>Neon")]
    A -->|"internal key"| I["AI service<br/>FastAPI · Render"]
    I -->|"read-only role"| D
    I --> L["Groq LLM"]
    A --> C["Cloudinary<br/>images"]
    A --> E["Resend<br/>email"]
    A <-->|"checkout / signed notify"| P["PayHere"]
    A -.->|"optional"| S["Notify.lk / Text.lk<br/>SMS"]
    A -.->|"optional"| M["Meta Graph API"]
```

Design rules the code enforces:

- **One writer.** Only the API changes data. The AI service connects with a read-only database role that can see the catalogue and PII-free sales views, nothing else.
- **Payments are confirmed by the gateway, not the browser.** An order becomes paid only on PayHere's signed server-to-server notification, checked against the order total.
- **Stock is a ledger.** Orders reserve stock inside a locked transaction; cancellations and expired unpaid orders release it, so concurrent buyers cannot oversell.
- **The shop keeps working if the AI is down.** Customer chat falls back to a plain catalogue search; analytics show an "unavailable" state instead of an error.

---

## Technology stack

| Layer | Technology |
| :--- | :--- |
| Storefront and admin | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, TanStack Query 5, Zustand 5 |
| API | NestJS 11 on Node.js 20, Prisma 6, class-validator, Passport JWT, bcrypt, Helmet |
| AI service | Python 3.12, FastAPI, asyncpg, Pydantic 2, statsmodels (Holt-Winters forecasting) |
| Data | PostgreSQL 16 (full-text search, append-only stock ledger, read-only AI role) |
| Integrations | PayHere, Cloudinary, Resend, Groq, Notify.lk / Text.lk (optional), Meta Graph API (optional) |
| Testing | Jest, Supertest, Pytest, Cypress 15, Playwright, k6 |
| Delivery | Docker / Docker Compose, GitHub Actions, Vercel, Render, Neon |

---

## Repository structure

```text
.
├── backend/                  NestJS API — see backend/README.md
│   ├── src/                  feature modules (auth, products, orders, payments, inventory,
│   │                         production, reviews, uploads, analytics, ai, notifications, …)
│   ├── prisma/               schema, migrations, local seed scripts
│   ├── scripts/              operations scripts (stock reconciliation, admin hand-over, …)
│   └── test/                 integration tests against a real PostgreSQL database
├── frontend/                 Next.js storefront, admin and worker portal — see frontend/README.md
│   ├── src/app/              routes: (shop), (auth), (admin), account, worker
│   ├── cypress/              Cypress end-to-end suites
│   └── e2e-playwright/       Playwright suites — see frontend/e2e-playwright/README.md
├── ai/                       FastAPI AI service — see ai/README.md
├── scripts/load/             k6 load tests — see scripts/load/README.md
├── docs/                     runbook, guides, architecture and design documents
├── .github/workflows/        CI, nightly browser tests, Render keep-alive
└── docker-compose.yml        local stack: frontend, API, AI service, PostgreSQL, Redis
```

---

## Getting started

### Prerequisites

- Docker Desktop (Compose v2) for the full stack
- Node.js 20 and npm 10 for running the API or storefront on their own
- Python 3.12 for running the AI service on its own (optional)

### Run the full stack with Docker

```bash
git clone https://github.com/DininduAkalanka/textile-automation-platform.git
cd textile-automation-platform

cp backend/.env.example backend/.env    # local defaults work as they are
docker compose up -d --build
```

| Service | Address |
| :--- | :--- |
| Storefront, admin and worker portal | http://localhost:3000 |
| API | http://localhost:3001/api/v1 (health: `/api/v1/health`) |
| AI service | http://localhost:8000 (health: `/health`) |
| PostgreSQL | `localhost:5433`, database `textile_db` |

The API container applies database migrations when it starts. To load the **sample catalogue** into the local database (optional):

```bash
cd backend
npm ci
DATABASE_URL="postgresql://textile_admin:textile_secure_pass_2024@localhost:5433/textile_db?schema=public" \
DIRECT_URL="postgresql://textile_admin:textile_secure_pass_2024@localhost:5433/textile_db?schema=public" \
npm run db:seed
```

The seed also creates one test account per role (admin, customer, worker) for local use. Their default passwords are defined in `backend/prisma/seed.ts` and work **only against a local database**: the seed refuses to write to a remote database unless that host is named explicitly and real passwords are supplied.

### Run services individually

```bash
# API (needs PostgreSQL; set DATABASE_URL / DIRECT_URL in backend/.env)
cd backend && npm ci && npx prisma migrate deploy && npm run start:dev

# AI service
cd ai && python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && uvicorn app.main:app --port 8000 --reload

# Storefront
cd frontend && npm ci && npm run dev
```

---

## Configuration

Each service reads its settings from environment variables. Copy the template next to the service and fill it in; never commit the real files.

| Service | Template | Must be set in production |
| :--- | :--- | :--- |
| API | [`backend/.env.example`](backend/.env.example) | `NODE_ENV`, database URLs, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `INTERNAL_API_KEY`, `AI_SERVICE_URL`, PayHere, Resend (`EMAIL_FROM` on a verified domain), Cloudinary |
| AI service | [`ai/.env.example`](ai/.env.example) | `DATABASE_URL_READONLY` (rotated password), `INTERNAL_API_KEY`, `LLM_API_KEY` |
| Storefront | [`frontend/.env.example`](frontend/.env.example) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` |

The full production matrix, with what each value controls, is in the [Runbook, section 2](docs/RUNBOOK.md#2-configuration).

---

## Testing

| Suite | Command | Needs |
| :--- | :--- | :--- |
| API unit tests | `cd backend && npm test` | — |
| API integration tests | `cd backend && npm run test:integration` | PostgreSQL (seeded) |
| Stock ledger check | `cd backend && npm run reconcile` | PostgreSQL |
| AI service tests | `cd ai && pytest` | Python dependencies |
| Storefront lint / types / build | `cd frontend && npm run lint && npx tsc --noEmit && npm run build` | — |
| Cypress end-to-end | `cd frontend && npm run test:e2e` | running local stack |
| Playwright end-to-end | `cd frontend && npm run test:pw` (smoke: `npm run test:pw:smoke`) | running local stack |
| Load tests (k6) | see [`scripts/load/README.md`](scripts/load/README.md) | running local stack |

**Continuous integration** ([`.github/workflows`](.github/workflows)):

| Workflow | When | What |
| :--- | :--- | :--- |
| `ci.yml` | every pull request and push to `main` | API build, unit and integration tests, stock reconciliation; storefront build and type check; Cypress; Playwright smoke |
| `playwright-nightly.yml` | nightly and on demand | full Playwright browser suite |
| `render-keepalive.yml` | during shop hours | pings the API and AI service (backup to the external pinger) |

The AI service tests are not part of CI yet; run them locally before changing `ai/`.

---

## Deployment

| Component | Host | Deploys |
| :--- | :--- | :--- |
| Storefront | Vercel | automatically on merge to `main` |
| API | Render (Docker, `backend/Dockerfile`) | on merge to `main` (auto-deploy) or manually; runs `prisma migrate deploy` on start |
| AI service | Render (Docker, `ai/Dockerfile`) | on merge to `main` (auto-deploy) or manually |
| Database | Neon (PostgreSQL 16) | migrations applied by the API |

Release flow: branch → pull request → all checks green → merge. Before a production release, work through the [pre-deploy checklist](docs/RUNBOOK.md#35-pre-deploy-checklist) and, for the first launch, the [go-live checklist](docs/GO_LIVE_CHECKLIST.md).

On Render's free tier a service sleeps after 15 minutes without traffic, and all free services in a workspace share 750 instance hours a month. The [Runbook, section 7](docs/RUNBOOK.md#7-keeping-the-render-free-services-awake) explains the keep-alive set-up and the hour budget.

---

## Security

- Passwords hashed with bcrypt; admin passwords need at least 12 characters (8 for customers and workers); accounts lock for 15 minutes after 5 failed sign-ins.
- 15-minute access tokens; refresh tokens are rotated, stored hashed and revoked on reuse, password change or deactivation.
- Every API route requires authentication unless explicitly public; admin and worker routes are role-checked; customers can only read their own orders, invoices and payments.
- PayHere notifications are verified by signature and amount; forged or replayed notifications cannot mark an order paid twice.
- The AI service accepts calls only with the internal key and reads the database through a read-only role.
- The storefront sends security headers (frame blocking, `nosniff`, referrer and permissions policies).

Details: [Security architecture](docs/09_SECURITY_ARCHITECTURE.md). To report a vulnerability, follow the [security policy](SECURITY.md); please do not open a public issue.

---

## Documentation

### Guides

| Document | For |
| :--- | :--- |
| [Admin guide](docs/ADMIN_GUIDE.md) | Shop owner and staff: running the shop day to day |
| [Go-live checklist](docs/GO_LIVE_CHECKLIST.md) | Launching the shop for real customers |
| [Runbook](docs/RUNBOOK.md) | Operations: hosting, configuration, releases, backups, secrets, incidents, keep-alive, staff accounts, go-live data reset |
| [Demo script](docs/DEMO_SCRIPT.md) | Presenting the system |

### Component READMEs

| Document | Covers |
| :--- | :--- |
| [backend/README.md](backend/README.md) | API modules, scripts, database and tests |
| [frontend/README.md](frontend/README.md) | Storefront, admin and worker portal; SEO; tests |
| [ai/README.md](ai/README.md) | AI service endpoints, safety model and tests |
| [frontend/e2e-playwright/README.md](frontend/e2e-playwright/README.md) | Running and writing Playwright tests |
| [scripts/load/README.md](scripts/load/README.md) | k6 load and webhook-burst tests |

### Architecture and design

| Document | Covers |
| :--- | :--- |
| [00 — Project vision](docs/00_PROJECT_VISION.md) | Problem, goals, users |
| [01 — Business requirements](docs/01_BUSINESS_REQUIREMENTS.md) | Business rules and acceptance criteria |
| [02 — System scope](docs/02_SYSTEM_SCOPE.md) | In and out of scope, roles |
| [03 — Software requirements](docs/03_SOFTWARE_REQUIREMENTS_SPECIFICATION.md) | Functional and non-functional requirements |
| [04 — System architecture](docs/04_SYSTEM_ARCHITECTURE.md) | Components and data flow |
| [05 — Technology stack](docs/05_TECHNOLOGY_STACK.md) | Technology choices and trade-offs |
| [06 — Database design](docs/06_DATABASE_DESIGN.md) | Schema design and indexing |
| [07 — API design](docs/07_API_DESIGN.md) | REST conventions and errors |
| [08 — AI integration design](docs/08_AI_INTEGRATION_DESIGN.md) | Assistants, retrieval, grounding |
| [09 — Security architecture](docs/09_SECURITY_ARCHITECTURE.md) | Authentication, authorisation, threats |
| [10 — UI/UX guidelines](docs/10_UI_UX_GUIDELINES.md) | Design tokens and patterns |
| [11 — Payment integration](docs/11_PAYMENT_INTEGRATION.md) | PayHere, cash on delivery, instalments |
| [12 — Deployment architecture](docs/12_DEPLOYMENT_ARCHITECTURE.md) | Hosting and environments |
| [13 — Testing strategy](docs/13_TESTING_STRATEGY.md) | Test pyramid and tooling |
| [Database architecture](docs/DATABASE_ARCHITECTURE.md) | Schema dictionary, ledger, AI views, ERD |
| [Database schema (DBML)](docs/database.dbml) | Renderable at [dbdiagram.io](https://dbdiagram.io/d) |
| [AI and ML architecture](docs/AI_AND_ML_ARCHITECTURE.md) | Assistants, forecasting, evaluation |
| [Coding standards](docs/CODING_STANDARDS.md) | Conventions for contributors |
| [Frontend UX playbook](docs/FRONTEND_UX_PLAYBOOK.md) | UX engineering practices |

### Security

| Document | Covers |
| :--- | :--- |
| [Security policy](SECURITY.md) | How to report a vulnerability privately |

---

## Contributing

1. Create a branch from `main` (`feat/…`, `fix/…`, `docs/…`).
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`fix(orders): …`).
3. Open a pull request; merge only when every check is green.
4. Never commit secrets or real `.env` files. When code reads a new environment variable, add it to the matching `.env.example` and to the Runbook.
5. Update the relevant README or document in the same pull request as the change.

---

## License

Copyright © 2026 Nandana Textile. All rights reserved; see [LICENSE](LICENSE). The code is published for reference only: it may not be used, copied or distributed without written permission.
