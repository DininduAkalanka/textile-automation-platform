# Nandana Textile — Production Runbook & Operations Guide

This runbook documents the deployment, operational lifecycle, secret rotation, backup/restore drills, and incident recovery procedures for the **Nandana Textile Smart Business & E-Commerce Platform**.

---

## 1. System Architecture & Topology

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
                      │           (NestJS 10 Backend)           │
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

---

## 2. Production Environment Matrix

### Backend (`apps/api` / Railway / Render)

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security guards, secure cookies, and strict CORS |
| `PORT` | `3001` (or `$PORT` assigned by host) | Application binding port |
| `DATABASE_URL` | `postgresql://...` | Pooled connection string from Neon / Supabase |
| `DIRECT_URL` | `postgresql://...` | Direct connection string for Prisma migrations |
| `FRONTEND_URL` | `https://nandanatextile.lk` | Storefront origin for strict CORS enforcement |
| `JWT_SECRET` | `openssl rand -hex 32` | 256-bit cryptographically secure token signing key |
| `JWT_EXPIRATION` | `7d` | Token expiration period |
| `INTERNAL_API_KEY` | `openssl rand -hex 32` | Shared secret between Backend and AI microservice |
| `AI_SERVICE_URL` | `https://ai.nandanatextile.lk` | Internal endpoint to FastAPI service |
| `AI_TIMEOUT_MS` | `30000` | Gateway timeout allowance (recommended 30s to absorb free-tier cold starts) |
| `PAYHERE_MERCHANT_ID` | Production Merchant ID | Live or sandbox merchant identifier |
| `PAYHERE_MERCHANT_SECRET` | Live Merchant Secret | Secret used for MD5 signature calculation |
| `PAYHERE_MODE` | `live` (or `sandbox`) | PayHere gateway environment switch |
| `PAYHERE_NOTIFY_URL` | `https://api.nandanatextile.lk/api/v1/payments/payhere/notify` | Public server-to-server webhook destination |
| `CLOUDINARY_CLOUD_NAME`| Cloud name | Cloudinary account identifier |
| `CLOUDINARY_API_KEY`   | API key | Cloudinary access key |
| `CLOUDINARY_API_SECRET`| API secret | Cloudinary secret |

### AI Service (`apps/ai` / Railway / Render)

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL_READONLY` | `postgresql://textile_ai_readonly:...` | **Read-only** Postgres user credentials (cannot execute mutations) |
| `LLM_PROVIDER` | `groq` (or `openai` / `anthropic`) | Active Large Language Model provider |
| `LLM_MODEL` | `openai/gpt-oss-120b` (or `gpt-4o`) | Model identifier |
| `LLM_API_KEY` | `gsk_...` | LLM provider API secret key |
| `INTERNAL_API_KEY` | Matches Backend `INTERNAL_API_KEY` | Shared secret for inter-service communication |

### Frontend (`apps/web` / Vercel)

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.nandanatextile.lk/api/v1` | Public API endpoint for browser calls |

---

## 3. Step-by-Step Deployment Guide

### A. Managed Database Provisioning (Neon / Supabase)
1. Create a project in [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. **The AI read-only user is created by the migrations — do not create it by hand.**
   `prisma migrate deploy` (run automatically when the backend container starts)
   creates `textile_ai_readonly` and grants it `SELECT` on an explicit allow-list
   only: the `products`, `categories` and `inventory` tables and the
   `ai_sales_facts` / `ai_inventory_facts` views. It can never read `users`
   (password hashes, emails, phones), `orders`, `payments` or anything else.

   > **Never** run `GRANT SELECT ON ALL TABLES IN SCHEMA public` or
   > `ALTER DEFAULT PRIVILEGES … GRANT SELECT ON TABLES` for this role. Either
   > one hands the AI service every customer's personal data and password hash,
   > and the default-privileges form keeps doing so for every future table.

3. **Rotate the role's password before the first AI deploy.** The migration
   creates it with the published development password
   `ai_readonly_local_dev_password`; the AI service refuses to start in
   production while `DATABASE_URL_READONLY` still uses it. As the database
   owner (Neon SQL editor or `psql`):
   ```sql
   -- Use a long random value, e.g. from: openssl rand -hex 24
   ALTER ROLE textile_ai_readonly WITH PASSWORD '<new-random-password>';
   ```
   Then set the AI service's `DATABASE_URL_READONLY` to
   `postgresql://textile_ai_readonly:<new-random-password>@<host>/<db>?sslmode=require`.

4. Verify the grants (expect exactly these five rows, all `SELECT`):
   ```sql
   SELECT table_name, string_agg(privilege_type, ',') AS privileges
   FROM information_schema.role_table_grants
   WHERE grantee = 'textile_ai_readonly'
   GROUP BY table_name ORDER BY 1;
   -- ai_inventory_facts | SELECT
   -- ai_sales_facts     | SELECT
   -- categories         | SELECT
   -- inventory          | SELECT
   -- products           | SELECT
   ```
   If anything else is listed (left over from the old instructions), remove it:
   ```sql
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM textile_ai_readonly;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM textile_ai_readonly;
   GRANT SELECT ON products, categories, inventory, ai_sales_facts, ai_inventory_facts
     TO textile_ai_readonly;
   ```

### B. Deploy Backend & AI to Railway / Render
1. Connect GitHub repository.
2. For Backend: Set Dockerfile path to `backend/Dockerfile`.
   - Add all environment variables from Section 2.
   - The container automatically runs `npx prisma migrate deploy` on boot before binding port 3001.
3. For AI Service: Set Dockerfile path to `ai/Dockerfile`.
   - Add read-only DB connection string and LLM API keys.

### C. Deploy Frontend to Vercel
1. Import GitHub repository on Vercel.
2. Root directory: `frontend`.
3. Set Environment Variable: `NEXT_PUBLIC_API_URL`.
4. Deploy!

### D. Pre-deploy checklist (security hardening from the QA remediation)
Check these before every production deploy that includes the QA fixes:

| # | Check | Why |
| :--- | :--- | :--- |
| 1 | AI service `INTERNAL_API_KEY` is a long random value (not `local-dev-internal-key`) and the backend uses the **same** value | The AI service refuses to start in production with the default key. |
| 2 | `textile_ai_readonly` password rotated (Section A, step 3) | The AI service refuses to start in production with the published password. |
| 3 | `SWAGGER_ENABLED` is unset or `false` on the backend; `AI_DOCS_ENABLED` unset on the AI service | API docs are off in production by default; only turn them on deliberately. |
| 4 | `ALLOW_DEV_OTP_BYPASS` is **not** set on the backend | Development-only; ignored when `NODE_ENV=production`, but keep it out of production config. |
| 5 | `PUBLIC_API_URL` is the backend's public `https://` origin, or unset on Render | Uploaded-image links are built from it (Render's `RENDER_EXTERNAL_URL` is used when unset), never from the request. |
| 6 | Image uploads are on persistent storage | Uploads are written to the container's `uploads/` folder. On Render's free tier that disk is wiped on every deploy/restart, so product and review photos disappear; attach a persistent disk or move uploads to object storage (e.g. Cloudinary). |
| 7 | `EMAIL_FROM` uses a domain verified in Resend | OTP and password-reset emails are rejected otherwise. |

---

## 4. PostgreSQL Backup & Restore Drill

### Automated Daily Backups
Both Neon and Supabase provide point-in-time recovery (PITR) and automatic daily snapshots enabled by default.

### Manual Backup Procedure (`pg_dump`):
```bash
pg_dump --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" -F c -f "nandana_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Drill Procedure (`pg_restore`):
To verify backup viability into a scratch/staging database:
```bash
# 1. Target scratch DB URL
export SCRATCH_DB_URL="postgresql://textile_admin:password@scratch-host:5432/scratch_db"

# 2. Replay the dump
pg_restore --clean --if-exists --no-owner --no-privileges -d "$SCRATCH_DB_URL" nandana_backup_*.dump

# 3. Run invariant audit on restored data
DATABASE_URL="$SCRATCH_DB_URL" npm run reconcile
```

---

## 5. Secret Rotation Playbook

When rotating credentials (e.g. JWT secret, DB password, PayHere keys):

1. **JWT Secret Rotation**:
   - Generate new secret: `openssl rand -hex 32`
   - Update in Railway / Render environment variables.
   - Restart API service (active users will be prompted to re-authenticate on next token refresh).
2. **Database Password Rotation**:
   - Update password in Neon / Supabase console.
   - Update `DATABASE_URL` in Backend and AI service environment settings.
   - Redeploy both services.
3. **PayHere Merchant Key Rotation**:
   - Update Secret in PayHere Merchant Portal.
   - Update `PAYHERE_MERCHANT_SECRET` on Backend and restart.

---

## 6. Incident Response & Rollback Procedures

### Rollback Strategy
1. **Frontend (Vercel)**:
   - Go to Vercel Dashboard → Deployments.
   - Click "Instant Rollback" to the previous verified production release.
2. **Backend / AI (Railway / Render)**:
   - Rollback to previous successful Docker image build via the dashboard.
   - Database migrations are designed to be backward-compatible (non-destructive).

### Stock Drift Recovery
If any stock discrepancy is suspected:
```bash
# 1. Inspect drift report
npm run reconcile

# 2. If only cache drift exists, repair:
npm run reconcile -- --repair
```
