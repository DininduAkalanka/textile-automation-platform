# Backend API

The NestJS REST API behind the Nandana Textile storefront, admin and worker portal. It is the only service that writes to the database.

Part of the [Nandana Textile platform](../README.md). Production configuration and operations: [Runbook](../docs/RUNBOOK.md).

---

## Overview

- **Base path** `/api/v1`. Health: `GET /api/v1/health` (liveness) and `GET /api/v1/health/ready` (database reachable).
- **Response envelope**: every response is `{ success, message, data, error, timestamp }`.
- **Authentication by default**: a global JWT guard protects every route; public routes opt out with `@Public()`. Role checks use `@Roles(...)`.
- **Validation**: DTOs with `class-validator`; unknown fields are rejected (`forbidNonWhitelisted`).
- **Configuration is validated at boot** (`src/common/config/env.validation.ts`): a missing or unsafe secret stops the app instead of running insecurely.
- **API docs**: Swagger UI at `/api/v1/docs` outside production, or when `SWAGGER_ENABLED=true`.

## Modules

| Module | Responsibility |
| :--- | :--- |
| `auth` | Registration, sign-in, refresh-token rotation, password change and reset, profile (name) |
| `verification` | Email / SMS verification codes for accounts and guest checkout |
| `products` | Catalogue, categories, search, related and frequently-bought-together products |
| `inventory` | Stock ledger: movements, adjustments, reorder levels, low-stock alerts, reconciliation |
| `orders` | Checkout (signed-in and guest), order lifecycle, cancellation, expiry of unpaid orders |
| `payments` | PayHere checkout and signed notifications, cash on delivery, instalment plans |
| `invoices` | PDF invoices |
| `production` | Production board and worker task flow (Cutting → Stitching → Finishing → Quality Check) |
| `reviews` | Reviews, photos, helpful votes, reports, moderation |
| `uploads` | Image uploads (Cloudinary in production, local disk in development) |
| `analytics` | Dashboard figures, CSV reports, analytics passed through from the AI service |
| `ai` | Gateway to the AI service, with fallback when it is unavailable |
| `notifications` | In-app notifications and admin alerts |
| `email`, `sms` | Resend email and Sri Lankan SMS gateways; log-only when not configured |
| `social` | Social captions and Facebook / Instagram posting |
| `common` | Guards, decorators, filters, interceptors, configuration and limits |

## Getting started

```bash
npm ci
cp .env.example .env            # see the comments in the file
npx prisma generate
npx prisma migrate deploy       # or `npm run db:migrate` while changing the schema
npm run start:dev               # http://localhost:3001/api/v1
```

PostgreSQL 16 is required. The repository's `docker-compose.yml` provides one on `localhost:5433`.

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run start:dev` | Development server with reload |
| `npm run build` / `npm run start:prod` | Production build and start |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests against a real database (`test/`) |
| `npm run test:cov` | Unit tests with coverage |
| `npm run lint` | ESLint (**applies fixes**) |
| `npm run db:migrate` | Create and apply a migration while developing |
| `npm run db:deploy` / `npm run db:status` | Apply pending migrations / show their status |
| `npm run db:seed` | Load the sample catalogue and local test accounts |
| `npm run db:seed:history` | Add sample sales history, production tasks and reviews |
| `npm run db:clean-reset` | Delete orders and products, then reload the sample data |
| `npm run db:studio` | Prisma Studio |
| `npm run reconcile` | Check the stock ledger against cached stock (`-- --repair` to fix the cache) |

The seed scripts write demo data with published passwords. They run only against a local database (`prisma/seed-guard.ts`); a remote database must be named explicitly with `ALLOW_DEMO_SEED` and given real passwords. **Never run them on the live shop.**

## Operations scripts (`scripts/`)

| Script | Purpose |
| :--- | :--- |
| `rotate-admin-account.ts` | Hand-over: move the admin to the owner's email with a temporary password and deactivate demo accounts. Dry run by default. If that email already has an account, use the SQL in the Runbook instead ([Runbook, section 8](../docs/RUNBOOK.md#8-accounts-admin-workers-and-demo-accounts)) |
| `reconcile-inventory.ts` | Stock ledger reconciliation (`npm run reconcile`) |
| `simulate-payhere-webhook.ts` | Sends a correctly signed PayHere notification for local testing |
| `download-uniform-images.ts` | Development helper: downloads sample uniform photos for the demo seed |

## Database

- Schema: `prisma/schema.prisma`; migrations in `prisma/migrations/` (applied by `prisma migrate deploy` when the container starts).
- Some objects live in SQL migrations rather than the Prisma schema: the full-text search index, the read-only AI role `textile_ai_readonly`, and the PII-free analytics views `ai_sales_facts` and `ai_inventory_facts`.
- `DATABASE_URL` is the pooled connection used at runtime; `DIRECT_URL` is the direct connection used by migrations.

Full reference: [Database architecture](../docs/DATABASE_ARCHITECTURE.md).

## Testing

- **Unit tests** (`src/**/*.spec.ts`) run without a database.
- **Integration tests** (`test/*.e2e-spec.ts`) start the full Nest application against PostgreSQL. CI runs them on a fresh database after `prisma migrate deploy` and `npm run db:seed`; locally, point `DATABASE_URL` and `DIRECT_URL` at a disposable database and set `NODE_ENV=test`.
