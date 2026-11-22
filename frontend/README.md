# Storefront, Admin and Worker Portal

The Next.js 16 (App Router) web application of the Nandana Textile platform: the customer storefront, the admin back office and the worker portal, served from one app.

Part of the [Nandana Textile platform](../README.md). It talks only to the [backend API](../backend/README.md).

> This Next.js version has breaking changes from older releases. Before changing framework-level code, read the guides bundled with it in `node_modules/next/dist/docs/`.

---

## Routes

| Area | Path | Notes |
| :--- | :--- | :--- |
| Storefront | `src/app/(shop)/` | Home, catalogue, product pages, cart, checkout, payment results, wishlist, policy pages |
| Sign-in | `src/app/(auth)/` | Sign in, register, verify, forgot and reset password |
| Customer account | `src/app/account/` | Orders, order detail, instalments, password and name |
| Admin | `src/app/(admin)/admin/` | Dashboard, orders, products, categories, inventory, production, payments, reviews, analytics, AI insights, reports |
| Worker portal | `src/app/worker/` | The signed-in worker's production tasks |

`src/proxy.ts` (Next.js 16's name for middleware) redirects signed-out visitors away from account, admin and worker pages. It is a convenience only: **access control is enforced by the API**, which rejects any request without the right role.

## Code layout

| Folder | Contents |
| :--- | :--- |
| `src/components/` | UI by feature (`home`, `products`, `cart`, `admin`, `production`, `reviews`, `chat`, …) and shared primitives in `ui/` |
| `src/lib/` | API client (`api.ts`, with automatic token refresh), API address rules (`api-url.ts`), site details (`site-config.ts`), image URLs, schemas |
| `src/hooks/` | TanStack Query hooks per domain (`use-orders`, `use-products`, …) |
| `src/store/` | Zustand stores: session, cart, wishlist, chat |
| `src/services/`, `src/types/` | Typed service helpers and shared types |

## Configuration

Copy [`.env.example`](.env.example) to `.env.local`. Only `NEXT_PUBLIC_*` values reach the browser, so never put secrets here. `NEXT_PUBLIC_*` values are built into the bundle: change them, then rebuild or redeploy.

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of the API, including `/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | The shop's public address (`https://www.nandanatextile.lk`), used for canonical URLs, the sitemap, robots.txt and structured data |
| `INTERNAL_BACKEND_URL` | Optional server-side API address for the `/uploads` proxy |
| `NEXT_PUBLIC_PRODUCTION_HOSTS` | Optional extra hostnames treated as the live shop |

Without `NEXT_PUBLIC_API_URL`, a build talks to the API on its own host at port 3001 and never to the live API, so a misconfigured preview fails visibly instead of writing to production (`src/lib/api-url.ts`).

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:e2e` / `npm run test:e2e:open` | Cypress, headless / interactive |
| `npm run test:pw` / `npm run test:pw:smoke` | Playwright, full / smoke suite |
| `npm run test:pw:ui` / `npm run pw:report` | Playwright UI mode / last HTML report |

End-to-end tests run against a local stack only; the configuration refuses non-local URLs so a test can never touch the live shop. Details: [e2e-playwright/README.md](e2e-playwright/README.md).

## Search engine optimisation

- `src/lib/site-config.ts` holds the shop's public address and contact details: change them there, not in pages.
- Each page sets its own title, description and canonical URL. Product pages (`src/app/(shop)/products/[slug]/layout.tsx`) add Product and BreadcrumbList structured data; the root layout adds the ClothingStore and WebSite data.
- Category landing pages (`/products?category=…`) are indexable; search, sort and filter variants, sign-in, cart, checkout and payment pages are `noindex`.
- `src/app/sitemap.ts`, `robots.ts` and `manifest.ts` generate those files; icons live in `src/app/` (`favicon.ico`, `icon.svg`, `apple-icon.png`).

## Images

Product and review photos come from the API as Cloudinary URLs. `normalizeImageUrl()` (`src/lib/image-url.ts`) adds automatic format and quality (`f_auto,q_auto`) for display, so browsers receive WebP or AVIF; the stored URL is unchanged.
