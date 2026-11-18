# Playwright QA report

## Checkpoint 1

Branch `qa/playwright-20261118` starts at `efc602f` on `qa/full-system-20261118`. The baseline ran before installing Playwright. The Docker runs use the production Next.js build with the API URL inlined as `http://127.0.0.1:3001/api/v1`.

| Check | Before Playwright | Final verification |
| --- | --- | --- |
| Cypress (9 specs, 35 cases) | 32 passed, 3 failed. 3m 19s spec time, 4m 03s elapsed | 32 passed, same 3 failed. 3m 02s spec time, 3m 41s elapsed |
| Chromium storefront smoke | — | 1 passed, 0 failed, 0 expected failures, 0 fixme. 3.1s test, 4.8s command, retries disabled |
| Frontend TypeScript and Next.js production build | Passed | Passed |
| Playwright-specific TypeScript | — | Passed |
| Frontend ESLint | 0 errors, 102 warnings | 0 errors, 102 warnings |
| Loopback checks | — | Non-local `PW_BASE_URL` and `PW_API_URL` each failed during test discovery |
| WebKit | — | Browser 27.2 launched. Application coverage begins with the cross-browser specs |

The first strict Playwright run failed at the console assertion after the storefront checks passed. An anonymous browser requested a session refresh and Chromium logged HTTP 401. The approved exception permits one exact resource message from the local refresh URL, matched to a real 401 on a POST with neither a Cookie nor an Authorization header. It also checks for repeated refreshes. The final smoke used the home page’s **View All Departments** link, checked the catalog response and found both seeded product names and detail URLs. No application changes or test hooks were needed.

The three pre-existing Cypress failures persisted after retry in both comparison runs. The other 32 cases passed without retry in the baseline and final run.

| Failure | Observation |
| --- | --- |
| `frontend/cypress/e2e/admin-crud.cy.ts:167` | Creating a product with an uploaded PNG received HTTP 400. The check expects 200 or 201. |
| `frontend/cypress/e2e/admin-crud.cy.ts:215` | The edited price `7,750` did not appear in the table before the assertion timed out. |
| `frontend/cypress/e2e/catalog-and-media-lifecycle.cy.ts:88` | The PNG upload received HTTP 400. The check expects 200 or 201. |

```text
Running 1 test using 1 worker
[chromium] home and catalog show seeded products to an anonymous shopper @smoke (3.1s)
1 passed (4.8s)

Cypress final: 9 specs, 35 tests, 32 passing, 3 failing, 0 pending, 0 skipped
```

The Docker runs used PostgreSQL 16.14, Node 24.19.0, Next.js 16.3.2, Cypress 15.20.1 and Playwright 1.65.1. The final image build reused the dependency layer prepared from the lockfile, installed browser system libraries, and ran the checked-in runner. The default Dockerfile passed `docker build --check`. No AI service or external provider was reachable from the test container. The temporary host database and matching role from the interrupted Windows setup were removed and their absence verified.

One passing smoke run establishes this checkpoint. The five-repeat flakiness gate, WebKit application cases, mobile, Firefox and CI runs are pending. There is no Playwright branch-protection check to enable at this checkpoint.

## Route inventory

The filesystem scan found 32 page routes and four metadata routes. The table records frontend navigation policy from `frontend/src/proxy.ts:35`. Run `node e2e-playwright/utils/inventory.mjs` in `frontend/` to regenerate it. The login redirect includes the requested path in `returnTo`. “Home” means redirect to `/`. “Allow” means the proxy passes the request. Access to individual records also depends on API authorization.

| Route | Route group | Guest | Customer | Worker | Manager | Admin | Checkpoint 1 coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | (shop) | Allow | Allow | Allow | Allow | Allow | Storefront smoke (guest) |
| `/account/orders` | — | Login | Allow | Allow | Home | Allow | Pending |
| `/account/orders/[id]` | — | Login | Allow | Allow | Home | Allow | Pending |
| `/account/orders/[id]/installments` | — | Login | Allow | Allow | Home | Allow | Pending |
| `/admin` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/ai-insights` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/analytics` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/categories` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/inventory` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/orders` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/orders/[id]` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/payments` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/production` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/products` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/reports` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/admin/reviews` | (admin) | Login | Home | Home | Home | Allow | Pending |
| `/apple-icon.png` | — | Allow | Allow | Allow | Allow | Allow | Pending |
| `/cart` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/checkout` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/contact` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/forgot-password` | (auth) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/icon.svg` | — | Allow | Allow | Allow | Allow | Allow | Pending |
| `/login` | (auth) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/payment/cancel` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/payment/success` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/products` | (shop) | Allow | Allow | Allow | Allow | Allow | Storefront smoke (guest) |
| `/products/[slug]` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/register` | (auth) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/reset-password` | (auth) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/returns-exchange` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/robots.txt` | — | Allow | Allow | Allow | Allow | Allow | Pending |
| `/sitemap.xml` | — | Allow | Allow | Allow | Allow | Allow | Pending |
| `/verify` | (auth) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/wishlist` | (shop) | Allow | Allow | Allow | Allow | Allow | Pending |
| `/worker` | — | Login | Home | Allow | Home | Allow | Pending |
| `/worker/tasks` | — | Login | Home | Allow | Home | Allow | Pending |

The anonymous `/verify` page prompts the visitor to sign in. The authorized `/worker` route redirects to `/worker/tasks`. The custom 404 page is exercised through an unknown URL. The built-in error boundary has no standalone public route.

## Seeded accounts and inventory

| Role | Seeded account |
| --- | --- |
| Admin | `admin@textileshop.com` |
| Customer | `customer@example.com` |
| Worker | `worker.cutting@textileshop.com`, `worker1@textileshop.com`, `worker.stitching@textileshop.com`, `worker2@textileshop.com` |
| Manager | No account in the default seed |

The default seed opens 35 inventory ledgers. All 35 products have positive stock. Three meet their low-stock threshold. All 20 uniforms require measurements. Future out-of-stock, custom-product and manager scenarios need their own data. See `backend/prisma/seed.ts:42` and `backend/src/inventory/inventory.service.ts:215`.

| SKU | Product | Opening stock | Low threshold | Stock status | Measurements |
| --- | --- | ---: | ---: | --- | --- |
| WMN-SAR-001 | Border Detailed Handloom Saree | 20 | 5 | In stock | No |
| WMN-TOP-002 | Engage Long Sleeve Striped Workwear Shirt | 35 | 8 | In stock | No |
| WMN-KRT-003 | Engage Embroidered Kurtha Top | 28 | 6 | In stock | No |
| WMN-SAR-004 | Printed Pure Cotton Saree | 25 | 5 | In stock | No |
| WMN-PNT-005 | Akasi Mid Waist Smart Workwear Pants | 30 | 8 | In stock | No |
| MEN-SHT-001 | Trafford Short Sleeve Cotton Shirt | 40 | 10 | In stock | No |
| MEN-SHT-002 | Men's Short Sleeve Printed Resort Shirt | 32 | 8 | In stock | No |
| MEN-SHT-003 | Trafford Printed Casual Short Sleeve Shirt | 30 | 7 | In stock | No |
| MEN-TRS-004 | Vantage Ultra Slim Fit Formal Trousers | 35 | 8 | In stock | No |
| MEN-CHN-005 | Moose Men's Chino Smart Casual Pants | 28 | 6 | In stock | No |
| TEN-TOP-001 | Tendenza Teen Wrapped Waist Shirt | 25 | 5 | In stock | No |
| TEN-DNM-002 | Vintage Wash Denim Trucker Jacket | 6 | 15 | Low | No |
| TEN-SKT-003 | Tendenza Teen Side Slit Skirt | 22 | 5 | In stock | No |
| TEN-TEE-004 | Tendenza Teen Stitch Printed T-Shirt | 30 | 6 | In stock | No |
| TEN-JMP-005 | Tendenza Teen Zipper Detailed Jumpsuit | 18 | 5 | In stock | No |
| UNI-SCH-001 | Girl's School Uniform Frock (5 Pleat) | 150 | 30 | In stock | Yes |
| UNI-SCH-002 | Boy's School Uniform Shirt - Short Sleeve | 140 | 30 | In stock | Yes |
| UNI-SCH-003 | Boy's School Uniform Short - Elasticated | 110 | 25 | In stock | Yes |
| UNI-SCH-004 | Girl's School Uniform Frock (Box Pleat) | 90 | 20 | In stock | Yes |
| UNI-SCH-005 | Boy's School Uniform Shirt - Long Sleeve | 80 | 20 | In stock | Yes |
| UNI-COR-001 | Tendenza Navy Elegance Blazer Jacket | 45 | 10 | In stock | Yes |
| UNI-COR-002 | Trafford Executive Long Sleeve Business Shirt | 80 | 20 | In stock | Yes |
| UNI-COR-003 | Vantage 4-Way Stretch Formal Suiting Trousers | 70 | 15 | In stock | Yes |
| UNI-COR-004 | Tendenza Front Dart Detailed Pencil Skirt | 55 | 12 | In stock | Yes |
| UNI-COR-005 | Formal Suiting Waistcoat Vest | 50 | 10 | In stock | Yes |
| UNI-HLT-001 | Bella Medical Doctor Consultation Overcoat | 100 | 25 | In stock | Yes |
| UNI-HLT-002 | Clinical Grade Hospital Scrub Set | 120 | 30 | In stock | Yes |
| UNI-HLT-003 | Executive Culinary Chef Overcoat | 50 | 15 | In stock | Yes |
| UNI-HLT-004 | Hospitality Food & Beverage Steward Vest | 8 | 25 | Low | Yes |
| UNI-HLT-005 | Nursing Healthcare Tunic Dress | 80 | 20 | In stock | Yes |
| UNI-IND-001 | Rainco Super Force Industrial Weatherproof Suit | 60 | 15 | In stock | Yes |
| UNI-IND-002 | High-Visibility Reflective Utility Jacket | 75 | 20 | In stock | Yes |
| UNI-IND-003 | Security Officer Long Sleeve Duty Shirt | 90 | 25 | In stock | Yes |
| UNI-IND-004 | Industrial Heavy Canvas Work Trousers | 80 | 20 | In stock | Yes |
| UNI-IND-005 | Anti-Static Cleanroom Specialist ESD Coat | 10 | 20 | Low | Yes |

## Cypress parity

Each row counts runnable test cases, including cases with several flows. The one Playwright smoke adds public storefront coverage. Full Cypress parity and route-by-role execution are scheduled after this checkpoint.

| Cypress spec | Cases | Playwright parity |
| --- | ---: | --- |
| `admin-crud.cy.ts` | 11 | Pending. |
| `admin-operations.cy.ts` | 4 | Pending. |
| `ai.cy.ts` | 2 | Pending. |
| `catalog-and-media-lifecycle.cy.ts` | 3 | Pending. |
| `customer-crud.cy.ts` | 4 | Case 1 shares catalog listing. Filters and detail remain pending. |
| `customer-journey.cy.ts` | 4 | Pending. |
| `payment-online.cy.ts` | 1 | Pending. |
| `security.cy.ts` | 3 | Pending. |
| `worker-journey.cy.ts` | 3 | Pending. |

The existing PayHere case sends the checkout hash and accepts a pending order. A payment-completion test must independently assert the ledger and order transition. The server acknowledges rejected notifications and records an audit result. HTTP success alone cannot establish payment success. See `frontend/cypress/e2e/payment-online.cy.ts:86` and `backend/src/payments/payments.service.ts:656`.

## Session and environment findings

- `frontend/src/lib/token-store.ts:11` uses memory and local storage under `token`. The auth store caches the user under `user` and sets the role hint cookie. The refresh cookie is HTTP-only. Reusing a revoked refresh token invalidates all active refresh tokens for that user. Future role fixtures must log in independently. See `backend/src/auth/auth.service.ts:148`.
- The test OTP requires a current verification record, a non-production backend and `ALLOW_DEV_OTP_BYPASS=true`. See `backend/src/verification/verification.service.ts:126`.
- The Axios request interceptor and the legacy fetch client both have paths to the hosted API. Build and runtime URLs are set to loopback, and Docker disables outbound networking during tests. The smoke uses a bundled placeholder for seeded Shopify images and system fonts for the Google stylesheet. The local catalog and auth endpoints are real. See `frontend/src/services/http.ts:74` and `frontend/src/lib/api.ts:7`.
- The older audit lists CORS and proxy throttling findings. The branch now uses an explicit CORS allowlist and configures trusted proxy handling. The prior report marks QA-003/L-03 and QA-007/L-04 remediated. QA-009 remains listed in the audit. This checkpoint adds no runtime evidence for those findings. See `docs/QA_FULL_SYSTEM_REPORT.md:348`, `backend/src/main.ts:20` and `frontend/src/hooks/use-auth.ts:33`.

## Running and maintaining the suite

The [suite README](../frontend/e2e-playwright/README.md) contains single-container Docker commands for PowerShell and Bash, project selection, and the fixture and tag conventions. CI jobs, branch protection, live AI, visual snapshots and post-deploy tests are outside this checkpoint.
