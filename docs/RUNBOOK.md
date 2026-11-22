# Production Runbook

How the live Nandana Textile platform is hosted, configured, released, backed up and recovered. Written for the developers who maintain it.

Shop owner and staff: see the [Admin guide](ADMIN_GUIDE.md). First launch: see the [Go-live checklist](GO_LIVE_CHECKLIST.md). Back to the [project README](../README.md).

> **Before any manual SQL on the live database, create a Neon backup branch (section 4).** Run live SQL only from the Neon SQL Editor or a trusted machine, and keep live connection strings out of the repository.

## Contents

1. [Production topology](#1-production-topology)
2. [Configuration](#2-configuration)
3. [Deploying](#3-deploying)
4. [Backups and restore](#4-backups-and-restore)
5. [Rotating secrets](#5-rotating-secrets)
6. [Incidents and rollback](#6-incidents-and-rollback)
7. [Keeping the Render free services awake](#7-keeping-the-render-free-services-awake)
8. [Accounts: admin, workers and demo accounts](#8-accounts-admin-workers-and-demo-accounts)
9. [Go-live data reset](#9-go-live-data-reset)

---

## 1. Production topology

| Component | Host | Address | Notes |
| :--- | :--- | :--- | :--- |
| Storefront, admin, worker portal | Vercel (project root `frontend`) | `https://www.nandanatextile.lk` | The bare domain redirects to `www`. The Vercel default domain `textile-automation-platform.vercel.app` also works. |
| API | Render web service, Docker (`backend/Dockerfile`) | `https://<api-service>.onrender.com/api/v1` | Applies database migrations when it starts |
| AI service | Render web service, Docker (`ai/Dockerfile`) | `https://<ai-service>.onrender.com` | Called only by the API, with the internal key |
| Database | Neon, PostgreSQL 16 | pooled and direct connection strings | The AI service uses the read-only role `textile_ai_readonly` |
| Images | Cloudinary | folder `nandana-uploads` | Product and review photos |
| Email | Resend | sending domain verified in Resend | Verification codes, password resets, receipts, admin alerts |
| Card payments | PayHere | sandbox or live | Orders become paid only on PayHere's signed server-to-server notification |
| Language model | Groq | — | Used by the AI service |
| SMS (optional) | Notify.lk or Text.lk | — | Not configured yet |
| Uptime pings | cron-job.org, with GitHub Actions as backup | — | Section 7 |

Each Render service's address is shown at the top of its page in the Render dashboard. The architecture diagram is in the [README](../README.md#architecture).

---

## 2. Configuration

Values live in each host's dashboard and never in the repository. The templates explain every variable: [`backend/.env.example`](../backend/.env.example), [`ai/.env.example`](../ai/.env.example), [`frontend/.env.example`](../frontend/.env.example).

- **Render** reads variables only when a service starts: deploy the service after changing one.
- **Vercel** compiles `NEXT_PUBLIC_*` values into the build: redeploy after changing one (Deployments → latest production deployment → Redeploy).

### 2.1 API (Render → API service → Environment)

`NODE_ENV=production` and the default port are set by `backend/Dockerfile`; do not override them.

| Variable | Production value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon **pooled** connection string (host contains `-pooler`, `sslmode=require`) | Runtime queries. Required: the API does not start without it. |
| `DIRECT_URL` | Neon **direct** connection string | Used by `prisma migrate deploy` at start-up |
| `JWT_SECRET` | output of `openssl rand -hex 32` | Signs 15-minute access tokens. At least 32 characters, or the API refuses to start. |
| `JWT_EXPIRATION` | `7d` | Refresh-session lifetime |
| `FRONTEND_URL` | `https://www.nandanatextile.lk` | Allowed browser origin; base of links in emails and of PayHere return addresses. Required. |
| `CORS_ALLOWED_ORIGINS` | `https://nandanatextile.lk` | Extra allowed origins, comma-separated |
| `AI_SERVICE_URL` | `https://<ai-service>.onrender.com` | Where the AI service is |
| `INTERNAL_API_KEY` | output of `openssl rand -hex 32` | Shared secret; must equal the AI service's value |
| `AI_TIMEOUT_MS` | `30000` | Long enough to absorb an AI service cold start |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary → Settings → API Keys | Photo storage. Required: Render's disk is wiped on every deploy and wake-up, so photos saved there disappear. |
| `RESEND_API_KEY` | Resend → API Keys | Without it, emails are only written to the log |
| `EMAIL_FROM` | `Nandana Textile <no-reply@your-verified-domain>` | Must use the domain verified in Resend (the live shop uses `notifications.nandanatextile.lk`). Resend's shared `onboarding@resend.dev` only delivers to the Resend account owner. |
| `ADMIN_ALERT_EMAIL` | the owner's inbox | New-order alerts and "refund needed" payment alerts. Skipped when unset. |
| `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET` | PayHere merchant portal | The secret is used only on the server, to sign and verify |
| `PAYHERE_MODE` | `sandbox` until the live merchant account is approved, then `live` | See the warning in section 3.5 |
| `PAYHERE_NOTIFY_URL` | `https://<api-service>.onrender.com/api/v1/payments/payhere/notify` | PayHere's server-to-server payment confirmation |
| `SHOP_BRAND`, `SHOP_BASE_URL`, `SHOP_WHATSAPP`, `SHOP_ADDRESS`, `SHOP_LANDLINE`, `SHOP_PAYMENTS`, `SHOP_REG_NO`, `SHOP_BANK` | the shop's real details | Social captions and PDF invoices. `SHOP_PAYMENTS` is repeated word for word in captions, so list only payment options the shop really offers. |

Optional:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PUBLIC_API_URL` | unset (Render's `RENDER_EXTERNAL_URL` is used) | Public origin of the API, for disk-stored upload links |
| `SWAGGER_ENABLED` | off in production | API docs at `/api/v1/docs`. Turn on only briefly and deliberately. |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_USER_ID`, `ADMIN_ALERT_PHONE` | unset | SMS verification codes and alerts, once an SMS gateway is contracted |
| `META_PAGE_ID`, `META_PAGE_TOKEN`, `META_IG_USER_ID`, `META_GRAPH_VERSION` | unset | Facebook and Instagram posting; captions work without them |
| `THROTTLE_LIMIT` | `100` | Requests per minute per client IP |
| `TRUST_PROXY_HOPS` | `1` on Render (automatic) | Proxies in front of the API, for the real client IP |
| Abuse limits | `ORDER_RESERVATION_TTL_MINUTES=30`, `MAX_OPEN_PENDING_ORDERS_PER_USER=3`, `MAX_OPEN_GUEST_ORDERS_PER_IP=3`, `MAX_QTY_PER_LINE=20`, `MAX_LINES_PER_ORDER=30`, `GUEST_CHECKOUT_THROTTLE_LIMIT=10`, `LOGIN_MAX_FAILURES=5`, `LOGIN_LOCK_MINUTES=15`, `REVIEW_UPLOADS_PER_DAY=20`, `REVIEW_UPLOAD_THROTTLE_LIMIT=10`, `ORPHAN_UPLOAD_TTL_HOURS=24` | The defaults are production values; see `backend/src/common/config/limits.ts` |

**Never set in production:** `ALLOW_DEV_OTP_BYPASS`, `ALLOW_DEV_OTP_LOGGING` (development only, ignored in production) and `ALLOW_DEMO_SEED` (allows the demo seed to write to a remote database). The `STRIPE_*` variables belong to a retired mock payment path and are not needed.

### 2.2 AI service (Render → AI service → Environment)

| Variable | Production value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL_READONLY` | `postgresql://textile_ai_readonly:<rotated-password>@<neon-host>/<database>?sslmode=require` | Read-only connection (section 3.1) |
| `INTERNAL_API_KEY` | the API's value | Calls without it are rejected |
| `LLM_PROVIDER` | `groq` | Model provider |
| `LLM_API_KEY` | Groq → API Keys | Without it, the customer assistant returns a plain product list |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model name |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1/chat/completions` | Provider endpoint |

Optional: `AI_DOCS_ENABLED` (leave unset; the interactive docs stay off in production) and the tuning values `LLM_TEMPERATURE` (0.2), `LLM_MAX_TOKENS` (700), `LLM_TIMEOUT_SECONDS` (30), `RETRIEVAL_K` (8), `MAX_MESSAGE_CHARS` (500) and `MAX_HISTORY_TURNS` (6).

Production mode is switched on automatically on Render (Render sets `RENDER`), and also by `ENVIRONMENT=production`, `NODE_ENV=production` or `AI_ENFORCE_PROD_SECRETS=true`. In production mode the service refuses to start with the default internal key or the default read-only password.

### 2.3 Storefront (Vercel → Project → Settings → Environment Variables)

| Variable | Production value | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://<api-service>.onrender.com/api/v1` | API base address used by the browser |
| `NEXT_PUBLIC_SITE_URL` | `https://www.nandanatextile.lk` | Canonical URLs, sitemap, robots.txt and structured data |
| `INTERNAL_BACKEND_URL` | optional | Server-side API origin for the `/uploads` proxy; derived from `NEXT_PUBLIC_API_URL` when unset |
| `NEXT_PUBLIC_PRODUCTION_HOSTS` | optional | Extra hostnames treated as the live shop |

Preview deployments use the variables of Vercel's Preview environment. If that environment has the live `NEXT_PUBLIC_API_URL`, previews read and write live data, so test on them as carefully as on the live shop.

---

## 3. Deploying

### 3.1 Database (Neon, one-time)

1. Create the Neon project (PostgreSQL 16). Copy the **pooled** connection string into the API's `DATABASE_URL` and the **direct** one into `DIRECT_URL`.
2. **The AI read-only role is created by the migrations; do not create it by hand.** `prisma migrate deploy` (run automatically when the API starts) creates `textile_ai_readonly` and grants it `SELECT` on an explicit allow-list only: the `products`, `categories` and `inventory` tables and the `ai_sales_facts` / `ai_inventory_facts` views. It can never read `users` (password hashes, emails, phone numbers), `orders`, `payments` or anything else.

   > **Never** run `GRANT SELECT ON ALL TABLES IN SCHEMA public` or `ALTER DEFAULT PRIVILEGES … GRANT SELECT ON TABLES` for this role. Either one hands the AI service every customer's personal data and password hash, and the default-privileges form keeps doing so for every future table.

3. **Rotate the role's password before the first AI deploy.** The migration creates it with the published development password `ai_readonly_local_dev_password`; the AI service refuses to start in production while `DATABASE_URL_READONLY` still uses it. As the database owner (Neon SQL Editor):

   ```sql
   -- Use a long random value, e.g. from: openssl rand -hex 24
   ALTER ROLE textile_ai_readonly WITH PASSWORD '<new-random-password>';
   ```

   Then set the AI service's `DATABASE_URL_READONLY` to `postgresql://textile_ai_readonly:<new-random-password>@<host>/<database>?sslmode=require`.

4. Check the grants. Expect exactly these five rows, all `SELECT`:

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

   If anything else is listed, remove it:

   ```sql
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM textile_ai_readonly;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM textile_ai_readonly;
   GRANT SELECT ON products, categories, inventory, ai_sales_facts, ai_inventory_facts
     TO textile_ai_readonly;
   ```

### 3.2 API and AI service (Render, one-time)

1. New → Web Service → connect the GitHub repository, runtime **Docker**.
2. Build from the service's own folder, because the Dockerfiles copy paths relative to it: `backend` with `backend/Dockerfile` for the API, `ai` with `ai/Dockerfile` for the AI service.
3. Health check path: `/api/v1/health` for the API, `/health` for the AI service.
4. Add the environment variables from section 2.
5. Turn on auto-deploy for the `main` branch.

The API container runs `npx prisma migrate deploy` before it starts, so a deploy applies any pending migration.

### 3.3 Storefront (Vercel, one-time)

1. Import the repository and set the root directory to `frontend` (Next.js is detected).
2. Add the environment variables from section 2.3.
3. Domains: `www.nandanatextile.lk` as the primary domain, with `nandanatextile.lk` redirecting to it.

Vercel deploys every push to `main` to production and builds a preview for every pull request.

### 3.4 Releasing a change

1. Branch from `main`, open a pull request and wait for every CI check to pass.
2. If the change includes a database migration: make sure the running version keeps working with the new schema (add columns and tables; do not rename or drop them in the same release), and create a Neon backup branch (section 4) before merging.
3. Merge. Vercel deploys the storefront; Render deploys the API and the AI service.
4. Smoke-test the live shop (about two minutes):
   - `https://<api-service>.onrender.com/api/v1/health/ready` answers 200 (the API and its database are up).
   - `https://<ai-service>.onrender.com/health` answers 200.
   - The home page and a product page load; sign in to the admin and check that the dashboard figures appear.
5. If anything is wrong, roll back (section 6).

### 3.5 Pre-deploy checklist

Check before every production deploy that changes configuration:

| # | Check | Why |
| :--- | :--- | :--- |
| 1 | The AI service's `INTERNAL_API_KEY` is a long random value (not `local-dev-internal-key`) and the API uses the **same** value | The AI service refuses to start in production with the default key; a mismatch makes every AI feature "unavailable". |
| 2 | The `textile_ai_readonly` password is rotated (section 3.1, step 3) | The AI service refuses to start in production with the published password. |
| 3 | `SWAGGER_ENABLED` is unset or `false`; `AI_DOCS_ENABLED` is unset | API docs stay off in production unless turned on deliberately. |
| 4 | `ALLOW_DEV_OTP_BYPASS`, `ALLOW_DEV_OTP_LOGGING` and `ALLOW_DEMO_SEED` are **not** set | Development-only switches. |
| 5 | `PUBLIC_API_URL` is the API's public `https://` origin, or unset on Render | Uploaded-image links are built from it (Render's `RENDER_EXTERNAL_URL` is used when unset), never from the request. |
| 6 | All three `CLOUDINARY_*` values are set | Without them photos are written to the container disk, which Render wipes on every deploy, restart and wake-up. This happened to the live shop's photos before Cloudinary was added. |
| 7 | `EMAIL_FROM` uses the domain verified in Resend | Verification codes and password-reset emails are rejected otherwise. |
| 8 | `PAYHERE_MODE` is `live` with live merchant keys, or card payment is not offered to real customers | In `sandbox` mode a test card "pays" and the order is marked paid with no money received. |
| 9 | `FRONTEND_URL` and `NEXT_PUBLIC_SITE_URL` are both `https://www.nandanatextile.lk` | Email links, PayHere return addresses and canonical URLs all depend on them. |
| 10 | `SHOP_PAYMENTS` lists only payment options the shop really offers | Captions repeat it word for word. |

---

## 4. Backups and restore

### Neon history and backup branches

- **Instant restore.** Neon keeps the history of each branch and can bring a branch back to any moment inside your plan's restore window: open the production branch in the Neon console and choose **Restore**, then pick a time just before the problem. The connection strings stay the same, open connections drop briefly, and Neon keeps the pre-restore state as a backup branch.
- **Backup branch before risky work.** Before manual SQL or a risky migration: Neon → Branches → New branch, parent = the production branch, name `backup-YYYYMMDD-<reason>`. It is an instant, complete copy. Delete it after about a week; it uses storage.
- **Undoing a bad change.** Restore the production branch to a time just before the change, as above. A backup branch created this way cannot be the source of Neon's "restore from another branch", which only accepts root branches; use it to inspect or copy data back, or as a temporary database by pointing `DATABASE_URL`, `DIRECT_URL` and `DATABASE_URL_READONLY` at its connection string.

### Manual backup (`pg_dump`)

Use the **direct** connection string, and a `pg_dump` at least as new as the server (version 16 or later):

```bash
pg_dump --no-owner --no-privileges -d "$DIRECT_URL" -F c -f "nandana_backup_$(date +%Y%m%d_%H%M%S).dump"
```

A dump contains customers' personal data and password hashes. Store it encrypted, never in the repository, and delete it when it is no longer needed.

### Restore drill

Restore into a scratch database, never into the live one:

```bash
# 1. A scratch database (local Docker, or a new Neon branch)
export SCRATCH_DB_URL="postgresql://textile_admin:<password>@<scratch-host>:5432/<scratch_db>"

# 2. Replay the dump
pg_restore --clean --if-exists --no-owner --no-privileges -d "$SCRATCH_DB_URL" nandana_backup_*.dump

# 3. Check the stock ledger on the restored data
cd backend && DATABASE_URL="$SCRATCH_DB_URL" npm run reconcile
```

---

## 5. Rotating secrets

| Secret | Where to change it | Steps | Effect |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | API | Set a new value from `openssl rand -hex 32` and deploy | Access tokens issued before stop working. Browsers silently get new ones with their refresh cookie, so nobody is signed out; to sign everyone out, also revoke all sessions (below). |
| `INTERNAL_API_KEY` | API **and** AI service | Set the same new value on both, then deploy both | AI features show "unavailable" until both run with the new key |
| `textile_ai_readonly` password | Neon and AI service | `ALTER ROLE textile_ai_readonly WITH PASSWORD '…'` (section 3.1), update `DATABASE_URL_READONLY`, deploy the AI service | The AI service cannot read the database between the two steps |
| Database owner password | Neon and API | Reset the role's password in Neon, update `DATABASE_URL` and `DIRECT_URL`, deploy the API | The API is down between the two steps |
| `PAYHERE_MERCHANT_SECRET` | PayHere and API | Generate the new secret in the PayHere merchant portal, update the API, deploy | Payments started with the old secret may fail verification; rotate when the shop is quiet |
| `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `LLM_API_KEY`, `META_PAGE_TOKEN` | the provider's dashboard and the service that uses it | Create the new key, update the variable, deploy, then delete the old key at the provider | None if done in that order |

Refresh sessions are random values stored as hashes, independent of `JWT_SECRET`. To sign every user out (for example after a suspected leak), revoke them all; everyone must sign in again within 15 minutes, or at once if `JWT_SECRET` is rotated at the same time:

```sql
UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL;
```

---

## 6. Incidents and rollback

### Rolling back

1. **Storefront:** Vercel → Deployments → the previous production deployment → **Instant Rollback**.
2. **API or AI service:** Render → the service → Events → the previous successful deploy → **Rollback**.
3. **Database:** a code rollback does not undo a migration. Migrations in this project only add to the schema, so the previous code version keeps working. If data itself must be undone, restore the database (section 4).

### Common problems

| Symptom | Likely cause | What to do |
| :--- | :--- | :--- |
| The first page load takes 30–60 seconds, then everything is fast | The Render free service was asleep | Set up the keep-alive (section 7) or move to a paid Render instance |
| AI Insights or Analytics say "not available" | The AI service is waking up, or `INTERNAL_API_KEY` differs between the services, or the read-only password is wrong | Wait a minute and refresh; open `https://<ai-service>.onrender.com/health`; compare the keys |
| Every Render service is suspended | The workspace used its 750 free instance hours | Section 7; upgrade, or wait for the next month |
| Upload fails with "Image storage is unavailable right now" | Cloudinary variables missing or wrong | Check the three `CLOUDINARY_*` values on the API |
| Customers do not receive verification or password-reset emails | `EMAIL_FROM` is not on the verified domain, the Resend key was revoked, or the quota is used up | Resend dashboard → Logs |
| A card payment went through but the order is still pending | PayHere's notification did not reach the API or failed verification | Check `PAYHERE_NOTIFY_URL`, `PAYHERE_MODE` and the merchant ID and secret. Unpaid card orders are cancelled automatically after 30 minutes; money that arrives for a cancelled order raises a "Refund needed" alert to every admin and `ADMIN_ALERT_EMAIL`, and is not counted as revenue. |
| Browser requests fail with CORS errors after a domain change | The new origin is not allowed | Add it to `FRONTEND_URL` or `CORS_ALLOWED_ORIGINS` and deploy the API |
| A user cannot sign in after several attempts | 5 wrong passwords lock the account for 15 minutes | Wait, or use "Forgot password?" (a reset also clears the lock) |
| Stock figures look wrong | The cached stock drifted from the ledger | Run `npm run reconcile` (report only), then `npm run reconcile -- --repair` to rebuild the cache |

To run the reconciliation against the live database, set the live `DATABASE_URL` for that one command only, on a trusted machine. In bash, this keeps it out of the shell history:

```bash
cd backend
read -rs DATABASE_URL && export DATABASE_URL   # paste the live URL, then Enter
npm run reconcile                              # report only; add "-- --repair" to rebuild the cache
unset DATABASE_URL
```

---

## 7. Keeping the Render free services awake

Render free web services spin down after **15 minutes without inbound traffic** and take up to about a minute to wake ([Render docs](https://render.com/docs/free)). While the AI service is waking, the AI Insights chat and the Analytics page show "not available". They recover on their own once it is awake, so a refresh a minute later works and a redeploy is not needed.

### Why GitHub Actions alone is not enough

GitHub runs `schedule` triggers late, and drops some under load. In November 2026 a cron asking for about 75 runs a day ran about **twice a day**, with 6–9 hour gaps. `.github/workflows/render-keepalive.yml` is kept only as a backup pinger and health alarm. It fails (red) if its secrets are missing or a service does not answer.

### Primary pinger: cron-job.org (free)

Create two cron jobs at [cron-job.org](https://cron-job.org):

| Field | API job | AI job |
| :--- | :--- | :--- |
| URL | `https://<api-service>.onrender.com/api/v1/health` | `https://<ai-service>.onrender.com/health` |
| Schedule | Every 10 minutes | Every 10 minutes |
| Hours | 09:00–19:59 | 09:00–19:59 |
| Time zone | Asia/Colombo | Asia/Colombo |
| Request timeout | 30 s | 30 s |

### Free-hour budget (important)

Render grants **750 free instance hours per workspace per month**, shared by all free services in it. If they run out, Render **suspends every free service until the next month**. Two services kept awake around the clock need about 1,488 hours, so keep-alive must be limited to a window:

`awake hours per day × 2 services × 31 days ≤ 750` → at most **about 11.5 hours a day**, minus real visitor traffic outside the window.

The 09:00–19:59 window keeps each service awake for about 11.25 hours a day (including the 15-minute tail): 11.25 × 2 × 31 ≈ **700 hours**, leaving about 50 hours for visitors outside the window. Other free services in the same workspace share this pool, so check Render → Workspace → Billing after the first week. A paid instance for the API removes both the sleep and the budget problem.

### Backup pinger: GitHub Actions

Add the repository secrets `RENDER_BACKEND_URL` and `RENDER_AI_URL` (Settings → Secrets and variables → Actions), then run the workflow once by hand (Actions → Render Services Keep-Alive → Run workflow) and confirm that both pings show HTTP 200.

---

## 8. Accounts: admin, workers and demo accounts

| Role | Can use | Lands on after sign-in |
| :--- | :--- | :--- |
| `ADMIN` | The whole back office, and the worker portal | `/admin` |
| `WORKER` | The worker portal: their own production tasks | `/worker/tasks` |
| `CUSTOMER` | The shop and their own account | `/` |

The schema also has a `MANAGER` role, but no screen or API route uses it yet.

**Live shop status:** the hand-over is done. The owner's account is the only active admin, and the demo accounts created by the seed script (whose passwords are in the repository) are deactivated. Use this section for later changes. There is no staff-management screen yet, so staff accounts are changed with the script or SQL below. Create a Neon backup branch first (section 4).

### 8.1 Move the admin account to a new email (script)

For an email that has **no account yet**. `backend/scripts/rotate-admin-account.ts` moves the admin account to that email with a random temporary password, revokes all of its saved sessions, and with `--deactivate-demo` deactivates the demo accounts and takes demo workers off the production board. Order history is kept and every change is written to the audit log. If the email already belongs to an account, the script stops without changing anything; use 8.2 instead.

1. Put the live `DATABASE_URL` (Render → API service → Environment) in `backend/.env.production.local`. This file is git-ignored.
2. Dry run, which changes nothing:

   ```bash
   cd backend
   npx ts-node scripts/rotate-admin-account.ts --env-file .env.production.local \
     --to <owner-email> --deactivate-demo
   ```

3. Check the printed database host and plan, then apply:

   ```bash
   CONFIRM_HOST=<the host it printed> npx ts-node scripts/rotate-admin-account.ts \
     --env-file .env.production.local --to <owner-email> --deactivate-demo --apply
   ```

4. Give the owner the temporary password it prints (shown once, stored nowhere). The owner signs in and sets their own password under **Change password**, or uses **Forgot password?** on the sign-in page.
5. Delete `backend/.env.production.local`.

### 8.2 Make an existing account an admin (SQL)

For a person who already has a customer account on the site. Their old password is replaced with a random one nobody knows, because admin passwords must be at least 12 characters; they then choose their own with "Forgot password?".

1. Generate a random password hash on your machine:

   ```bash
   cd backend
   node -e "const b=require('bcrypt'),c=require('crypto');console.log(b.hashSync(c.randomBytes(32).toString('hex'),12))"
   ```

2. In the Neon SQL Editor, with the person's email and the hash from step 1:

   ```sql
   BEGIN;

   UPDATE users
   SET role = 'ADMIN',
       password_hash = '<hash-from-step-1>',
       reset_token_hash = NULL, reset_expires_at = NULL, reset_channel = NULL,
       failed_login_attempts = 0, locked_until = NULL,
       is_active = true,
       updated_at = now()
   WHERE email = '<their-email>' AND role = 'CUSTOMER';

   -- Sign out every saved session of that account
   UPDATE refresh_tokens SET revoked_at = now()
   WHERE revoked_at IS NULL
     AND user_id IN (SELECT id FROM users WHERE email = '<their-email>');

   COMMIT;
   ```

   The first statement must report `UPDATE 1`. `UPDATE 0` means the email is wrong or the account is not a customer account; nothing was changed.

3. The person opens **Sign in → Forgot password?**, follows the emailed link (valid for 15 minutes) and sets a password of at least 12 characters.

### 8.3 Add a worker

1. The worker registers a normal account on the shop with their own email and password, and verifies it.
2. In the Neon SQL Editor, with their email and their stage (`CUTTING`, `STITCHING`, `FINISHING` or `QUALITY_CHECK`):

   ```sql
   BEGIN;

   -- 1. The account becomes a worker (only if it is still a customer account)
   UPDATE users
   SET role = 'WORKER', updated_at = now()
   WHERE email = '<worker-email>' AND role = 'CUSTOMER' AND is_active;

   -- 2. Put it on the production board's worker list
   INSERT INTO workers (id, user_id, specialization, is_active, created_at, updated_at)
   SELECT gen_random_uuid(), id, 'STITCHING', true, now(), now()
   FROM users
   WHERE email = '<worker-email>' AND role = 'WORKER'
   ON CONFLICT (user_id) DO UPDATE SET is_active = true, updated_at = now();

   COMMIT;
   ```

   Expect `UPDATE 1` and `INSERT 0 1`. Running it again is harmless.

3. The worker signs out and in again; they land on `/worker/tasks`. The admin can now assign them tasks on the production board.

### 8.4 Remove a worker or other staff member

Reassign their unfinished tasks on the production board first. Then:

```sql
BEGIN;

-- Off the production board's worker list
UPDATE workers SET is_active = false, updated_at = now()
WHERE user_id IN (SELECT id FROM users WHERE email = '<their-email>');

-- The account can no longer sign in (its history is kept)
UPDATE users SET is_active = false, updated_at = now()
WHERE email = '<their-email>';

-- Sign out every saved session
UPDATE refresh_tokens SET revoked_at = now()
WHERE revoked_at IS NULL
  AND user_id IN (SELECT id FROM users WHERE email = '<their-email>');

COMMIT;
```

The API checks on every request that the account is still active, so a deactivated account is refused from its next request on.

---

## 9. Go-live data reset

Run once, before opening the shop to real customers, to remove the demonstration data.

> **Never run `npm run db:clean-reset` or any seed script on the live database.** They add the demonstration catalogue, orders and test accounts back.

| Removed | Kept |
| :--- | :--- |
| All products and stock, orders and payments, instalments, reviews, production tasks, social posts, notifications, uploaded-photo records, verification codes, saved sessions, the audit log, and every account except the owner's admin account (including any workers) | The owner's admin account and its password, the categories, and the database structure |

Add workers (section 8.3) **after** the reset; the reset removes every account except the owner's.

1. **Backup.** Neon → Branches → New branch, parent = the production branch, name `backup-before-launch-reset`.
2. **Reset.** In the Neon SQL Editor on the production branch, replace `<owner-admin-email>` with the owner's admin email (in both places) and run:

   ```sql
   BEGIN;

   -- Safety: stop, and delete nothing, unless the owner's admin account exists.
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM users
                    WHERE email = '<owner-admin-email>' AND role = 'ADMIN' AND is_active) THEN
       RAISE EXCEPTION 'Owner admin account not found. Nothing was deleted.';
     END IF;
   END $$;

   -- Reviews (they point at products, orders and customers)
   DELETE FROM review_helpful_votes;
   DELETE FROM review_reports;
   DELETE FROM product_reviews;

   -- Social posts, production board, payments
   DELETE FROM social_posts;
   DELETE FROM production_tasks;
   DELETE FROM installments;
   DELETE FROM payments;
   DELETE FROM payment_webhook_events;

   -- Orders and stock history
   DELETE FROM order_status_history;
   DELETE FROM inventory_movements;
   DELETE FROM order_items;
   DELETE FROM orders;

   -- Catalogue (categories are kept so the shop menu still works)
   DELETE FROM inventory;
   DELETE FROM products;

   -- Per-person and temporary data
   DELETE FROM notifications;
   DELETE FROM customer_measurements;
   DELETE FROM uploaded_images;
   DELETE FROM verification_codes;
   DELETE FROM contact_verification_codes;
   DELETE FROM refresh_tokens;
   DELETE FROM audit_logs;

   -- Every account except the owner's admin account
   DELETE FROM workers;
   DELETE FROM users
   WHERE NOT (email = '<owner-admin-email>' AND role = 'ADMIN');

   COMMIT;
   ```

   If it stops with "Owner admin account not found", nothing was deleted: check the email.

3. **Verify.** Expect `1 | 0 | 0` followed by the number of categories:

   ```sql
   SELECT (SELECT count(*) FROM users)      AS users,
          (SELECT count(*) FROM products)   AS products,
          (SELECT count(*) FROM orders)     AS orders,
          (SELECT count(*) FROM categories) AS categories;
   ```

4. **Photos (optional).** In the Cloudinary Media Library, delete the demonstration photos in the `nandana-uploads` folder.
5. **Start fresh.** Everyone is signed out: the owner signs in again and adds the real products (Admin → Products). Keep the backup branch for about a week, then delete it.

This script was tested on a copy of the database filled with the demonstration data (667 orders, 35 products): it left exactly the owner's admin account and the categories, and with an email that does not match an active admin it deleted nothing.
