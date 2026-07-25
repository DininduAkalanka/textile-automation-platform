# Smart Textile Business Management & AI-Powered E-Commerce Platform

**Nandana Textile** — a full-stack platform for a Sri Lankan textile retailer and uniform manufacturer: a customer storefront, an admin dashboard, a factory worker portal, multi-method payments, a real-time inventory ledger, production tracking, and a dual AI layer (a customer shopping assistant + an owner business-intelligence assistant).

[![CI](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DininduAkalanka/textile-automation-platform/actions/workflows/ci.yml)

> University final-year capstone, built to production standard. See `IMPLEMENTATION_PLAN.md` for the authoritative spec and `docs/` for the design documents (00–13 + coding standards).

---

## Table of contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start (Docker — recommended)](#quick-start-docker--recommended)
- [Demo accounts](#demo-accounts)
- [Service URLs & ports](#service-urls--ports)
- [Environment variables](#environment-variables)
- [Testing PayHere payments (sandbox)](#testing-payhere-payments-sandbox)
- [Running the tests](#running-the-tests)
- [Running without Docker](#running-without-docker-optional)
- [Useful scripts](#useful-scripts)
- [Project structure](#project-structure)
- [Contributing (Git workflow)](#contributing-git-workflow)

---

## Features

| Area | What it does |
|---|---|
| **Storefront** | Browse/search catalogue, product detail, cart with measurement capture, AI shopping assistant |
| **Checkout & payments** | Server-recomputed totals, race-safe stock reservation, **PayHere** (card), **Cash on Delivery**, and bank transfer |
| **Inventory** | Single-source-of-truth **movement ledger** (reserve → sell → release), low-stock alerts, reconciliation |
| **Production** | Auto-created cutting → stitching → finishing → QC tasks, worker portal, order auto-advance |
| **Order management** | Full lifecycle both sides, customer tracking timeline, admin operations |
| **Dashboard & analytics** | Revenue/orders metrics, **demand forecasting** (Holt-Winters), reorder suggestions, CSV reports |
| **AI** | Customer assistant (retrieval-grounded RAG) + owner assistant (whitelisted function-calling, no text-to-SQL) |
| **Marketing** | Auto-generate a social caption and post to **Facebook/Instagram** (Meta Graph API) or share to WhatsApp |
| **Accounts** | Dual identity (email **or** phone), OTP verification, JWT auth with hashed refresh tokens, RBAC |

---

## Tech stack

- **Frontend** — Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS · Zustand · TanStack Query · Recharts
- **Backend** — NestJS · TypeScript · Prisma ORM · PostgreSQL 16 · class-validator · Jest
- **AI service** — Python 3.11 · FastAPI · statsmodels (forecasting) · asyncpg
- **Infra** — Docker Compose · Redis 7 (optional cache) · GitHub Actions CI

---

## Architecture

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

The API is the only writer to the database. The AI service connects through a **read-only, PII-free** role. Payments are confirmed only by verified, idempotent webhooks.

---

## Prerequisites

- **Docker Desktop** (the recommended path — nothing else needed), **or**
- **Node.js 20+** and **Python 3.11+** and a local **PostgreSQL 16** (to run without Docker).
- Git.

---

## Quick start (Docker — recommended)

```bash
# 1. Clone
git clone https://github.com/DininduAkalanka/textile-automation-platform.git
cd textile-automation-platform

# 2. Create the backend env file (edit the secrets afterwards)
cp backend/.env.example backend/.env

# 3. Build & start everything
docker compose up -d --build
```

That's it. On first boot the backend container **automatically applies migrations and seeds demo data** (`migrate deploy && db:seed && start`), so the shop is ready with products, users, and stock.

Optional — add ~40 weeks of backdated sales so the **analytics/forecast** charts have real signal:
```bash
docker compose exec backend npm run db:seed:history
```

Open **http://localhost:3000** and sign in with a [demo account](#demo-accounts).

> **Note:** the `DATABASE_URL`/`REDIS_HOST` values in `backend/.env` are for running *outside* Docker; `docker-compose.yml` overrides them to the internal Docker network automatically. You only need to edit the *secret* values (JWT, PayHere, etc.).

---

## Demo accounts

Seeded automatically. Passwords are development-only.

| Role | Email | Password |
|---|---|---|
| **Admin / Owner** | `admin@textileshop.com` | `Admin@123456` |
| **Customer** | `customer@example.com` | `Customer@123456` |
| **Worker (cutting)** | `worker.cutting@textileshop.com` | `Worker@123456` |
| **Worker (stitching)** | `worker.stitching@textileshop.com` | `Worker@123456` |

---

## Service URLs & ports

| Service | URL | Port |
|---|---|---|
| Frontend (storefront + admin + worker) | http://localhost:3000 | 3000 |
| Backend API | http://localhost:3001/api/v1 | 3001 |
| AI service | http://localhost:8000 | 8000 |
| PostgreSQL | `localhost:5433` (→ 5432 in container) | 5433 |
| Redis | `localhost:6379` | 6379 |

Key frontend areas: `/` storefront · `/admin` dashboard · `/worker/tasks` worker portal.

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. Required to boot:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (overridden inside Docker) |
| `JWT_SECRET` | ≥ 32 chars — signs access tokens (**app refuses to boot if too short**) |
| `FRONTEND_URL` | CORS origin (`http://localhost:3000`) |

Optional integrations (all **degrade gracefully** — the app runs without them):

| Group | Variables | Without them |
|---|---|---|
| **PayHere** | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_MODE`, `PAYHERE_NOTIFY_URL` | Card payments disabled; COD/bank still work |
| **Email / SMS** | `RESEND_API_KEY`, `EMAIL_FROM`, `SMS_PROVIDER`, `SMS_API_KEY`… | Sends become logged no-ops |
| **AI** | `AI_SERVICE_URL`, `INTERNAL_API_KEY`, `LLM_API_KEY` | Falls back to plain search; dashboards still work |
| **Social** | `META_PAGE_ID`, `META_PAGE_TOKEN`, `META_IG_USER_ID`, `SHOP_*` | Caption still generates for copy/WhatsApp; auto-post skipped |

Secrets are never committed. Update `backend/.env.example` whenever a new variable is added.

---

## Testing PayHere payments (sandbox)

Card payments use **PayHere sandbox**. The catch most people hit: after payment, **PayHere's server calls your API** to confirm the order — and it **cannot reach `localhost`**, so you need a public tunnel.

**1. Get sandbox credentials** — sign up at **https://sandbox.payhere.lk**, then from the dashboard put your Merchant ID + Secret in `backend/.env`:
```
PAYHERE_MERCHANT_ID="12xxxxx"
PAYHERE_MERCHANT_SECRET="your-sandbox-secret"
PAYHERE_MODE="sandbox"
```

**2. Expose the webhook with ngrok** (essential — the order only confirms via this callback):
```bash
ngrok http 3001
# then in backend/.env:
PAYHERE_NOTIFY_URL="https://<your-id>.ngrok-free.app/api/v1/payments/payhere/notify"
```
Restart: `docker compose restart backend`.

**3. Pay with a sandbox test card:**

| Card | Number |
|---|---|
| Visa | `4916217501611292` |
| Mastercard | `5307732125531191` |
| Amex | `346781005510225` |

Expiry: any future date · CVV: any 3 digits (Amex 4) · OTP (if shown): `123456`.

**4. Verify** — after redirect to `/payment/success`, the order should be **CONFIRMED**, stock deducted, and the payment **COMPLETED** (check **Admin → Orders / Payments**).

**No ngrok / no account?** Test the webhook logic directly with the signed simulator (place a card order first to get its number):
```bash
cd backend
export $(grep -v '^#' .env | xargs)          # load env (Git Bash / macOS / Linux)
ts-node scripts/simulate-payhere-webhook.ts <orderNumber> <amount>
```

---

## Running the tests

```bash
# Backend — unit tests (mock Prisma, no DB needed)
cd backend && npm test

# Backend — integration/e2e (needs a Postgres; race + ledger + RBAC)
npm run test:integration

# Backend — inventory ledger reconciliation
npm run reconcile

# Frontend — typecheck & build
cd frontend && npx tsc --noEmit && npm run build

# AI service
cd ai && pytest
```

CI (GitHub Actions) runs the backend build, unit tests, a real-Postgres migration + seed + integration suite, reconciliation, and the frontend build on every push and PR.

---

## Running without Docker (optional)

<details>
<summary>Expand for local (non-Docker) setup</summary>

```bash
# PostgreSQL 16 must be running locally and DATABASE_URL set in backend/.env

# Backend
cd backend
npm install
npm run db:deploy     # apply migrations
npm run db:seed       # seed demo data
npm run start:dev     # http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev           # http://localhost:3000

# AI service (new terminal)
cd ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
</details>

---

## Useful scripts

Run from `backend/`:

| Command | Description |
|---|---|
| `npm run db:seed` | Seed catalogue, users, inventory (idempotent) |
| `npm run db:seed:history` | Backdated sales for the analytics/forecast demos |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:reset` | Drop, re-migrate, re-seed (**destroys data** — dev only) |
| `npm run reconcile` | Audit the inventory ledger balances |
| `npm run test:integration` | Full integration/e2e suite |

Database ER diagram: open `docs/database.dbml` at **[dbdiagram.io/d](https://dbdiagram.io/d)** to render/export it.

---

## Project structure

```
.
├── backend/            NestJS API (auth, orders, payments, inventory,
│   ├── src/            production, analytics, ai proxy, social, uploads)
│   ├── prisma/         schema + migrations + seeds
│   └── test/           integration / e2e specs
├── frontend/           Next.js 16 app (storefront, admin, worker)
│   └── src/app/        (shop) · (admin)/admin · worker · (auth)
├── ai/                 FastAPI service (RAG chat, forecasting, analytics tools)
├── docs/               design documents 00–13 + database.dbml
├── docker-compose.yml  full local stack
└── IMPLEMENTATION_PLAN.md   authoritative build spec
```

---

## Contributing (Git workflow)

`main` is protected and always deployable. All work goes through a branch and a pull request:

```bash
git checkout -b feat/your-feature
# ... commit in small, conventional commits (feat:, fix:, docs:) ...
git push -u origin feat/your-feature
# open a PR on GitHub → CI must pass → review → merge → delete branch
```

CI (lint, typecheck, tests, build) runs on every PR and must be green before merging.

---

*Built as a university final-year project. Not affiliated with any commercial entity.*
