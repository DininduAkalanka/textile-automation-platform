# Frontend Engineering & UX Playbook — Textile Automation Platform
**Written as:** a senior frontend engineer + e-commerce UX specialist, based on direct code inspection (not the earlier surface-level pass).
**What changed since the last audit:** last time I explicitly scored the frontend 5.5/10 on *partial evidence* — I'd only verified token-storage security, not the actual UI/UX. I've now read the component library, `ProductCard`, `Header`, the checkout flow, `next.config.ts`, and the global stylesheet directly. This document is that real review.

---

## Where the frontend already gets it right

Credit where due, because some of this is genuinely above-average:

- **Real e-commerce feature depth.** A `VisualSearchModal` (749 lines) and `QuickViewModal` (686 lines) exist — visual/image search and quick-view are features many funded e-commerce platforms don't bother building. This is not a template site.
- **Tap-target discipline.** `Button`'s size scale is deliberately 44px on mobile settling to 40px on desktop (`h-11 ... sm:h-10`), with a separate 48px `touch` size explicitly reserved for the worker portal's factory-floor use case. That's the kind of detail that only shows up when someone has actually thought about who's holding the device.
- **Double-submit prevention** is built into the `Button` component itself (`disabled={disabled ?? loading}`) rather than left to every call site to remember.
- **Icon-button accessibility in the header is good**: `aria-label` on search, wishlist, cart, account, mobile menu open/close — screen reader users can actually navigate primary nav.
- **Loading state exists for cart icon feedback** ("Added" state with checkmark swap on add-to-cart) — good micro-interaction instinct.

The problem isn't taste or feature ambition. It's **consistency and a few specific, fixable technical gaps** — the kind a senior review is supposed to catch before they compound.

---

## Finding 1 (HIGH) — Three competing styling systems in one component tree

**Evidence:** `ProductCard.tsx` alone mixes Tailwind utility classes (`className="animate-fade-in-up"`), a bespoke CSS class system (`product-card`, `overlay-action-btn`, defined somewhere in a **1,239-line** `globals.css`), CSS custom properties (`var(--clr-brand)`, `var(--r-xs)`), and large inline `style={{...}}` objects with literal values — sometimes for the *same element* (`className="product-card-img-wrap"` **and** an inline `style` on the same `<div>`). Hover states are implemented with `onMouseEnter`/`onMouseLeave` handlers that mutate `e.currentTarget.style` directly, bypassing React state and CSS entirely.

**Why it matters for a senior/production codebase:**
- Three sources of truth for the same visual property means a design change (e.g., "make all cards use 8px more shadow on hover") requires hunting across Tailwind config, `globals.css`, and inline literals — not a global token edit.
- `onMouseEnter`/`onMouseLeave` DOM-mutation hover states don't fire on touch devices, so mobile users (the majority of e-commerce traffic) get **no hover feedback at all** on these cards, while desktop gets JS-driven hover instead of a free, GPU-accelerated CSS `:hover` transition.
- Inline style objects are recreated on every render (new object literal each render) — a real, if small, performance cost multiplied across every card in a grid.
- shadcn/ui (already installed — see `Button`) is a Tailwind-first system. Fighting it with inline styles means you're paying for Tailwind's bundle *and* writing custom CSS *and* writing inline styles, for the same problem.

**Recommended fix:**
```tsx
// Before — inline style + JS hover
<article style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.04)', ... }}
  onMouseEnter={e => { e.currentTarget.style.boxShadow = '...'; }}>

// After — one system, CSS handles the interaction for free
<article className="group relative flex flex-col overflow-hidden bg-surface
  shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-shadow duration-200
  hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5">
```
Pick **one** system (Tailwind + a small `tailwind.config` token layer for the brand colors currently living in `globals.css` custom properties) and migrate component-by-component. This is mechanical, low-risk work — good for a dedicated cleanup sprint, not urgent enough to block anything, but it will keep compounding in cost the longer it's left.

---

## Finding 2 (HIGH) — Checkout form labels aren't programmatically associated with inputs

**Evidence** (`app/(shop)/checkout/page.tsx`, confirmed directly):
```tsx
<label className="input-label">Full Name *</label>
<input data-testid="checkout-name-input" className="input" name="fullName" ... />
```
No `htmlFor` on the label, no matching `id` on the input. This pattern repeats for **every field in the checkout form** — name, email, phone, address lines, city, province, postal code, country, password.

**Why this is the single highest-priority UX fix on the whole site:** this is your **checkout page** — the one screen where every point of friction has a direct revenue cost.
- **Screen reader users** get an unlabeled input, or at best a placeholder that's announced once and then disappears the moment they start typing — they may not know what field they're in.
- **Every user, not just assistive-tech users**, loses the "click the label to focus the field" behavior — a small thing, but it's free usability you're currently not getting.
- This is a **WCAG 2.1 failure** (1.3.1 Info and Relationships, 4.1.2 Name/Role/Value) — a real legal/compliance exposure in many jurisdictions for a commercial checkout flow, not just a nice-to-have.

**Recommended fix — five minutes per field, no design change required:**
```tsx
<label htmlFor="checkout-fullname" className="input-label">Full Name *</label>
<input id="checkout-fullname" data-testid="checkout-name-input" className="input"
  name="fullName" value={address.fullName} onChange={handleChange} required />
```
This is the single quick win I'd do *before* the styling-system consolidation above — it's smaller, faster, zero visual risk, and it's on the highest-stakes page in the app.

---

## Finding 3 (MEDIUM-HIGH) — Next/Image optimization is disabled site-wide

**Evidence:** `unoptimized` is set on the `<Image>` component in `ProductCard.tsx` and 6 other locations across the frontend. `next.config.ts` has no `images.remotePatterns` or `domains` configured — which is almost certainly *why* `unoptimized` was added (a quick fix for "external image host isn't in the allowlist" rather than actually allowlisting it).

**Why it matters:** `unoptimized` disables Next.js's automatic responsive `srcset` generation, on-the-fly resizing, and modern-format conversion (WebP/AVIF). For an e-commerce site, **product images are almost always the largest contributor to page weight and LCP (Largest Contentful Paint)** — the exact metric Google uses for both Core Web Vitals ranking and the metric most correlated with bounce rate on product listing pages. You're serving full-resolution originals to every device, including phones on cellular connections.

**Recommended fix:**
```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "your-upload-host.com" },
      // add every host that serves product images (backend /uploads, Cloudinary, etc.)
    ],
    formats: ["image/avif", "image/webp"],
  },
};
```
Then remove `unoptimized` from the 7 call sites. If the real blocker was that uploaded images come from a dynamic/self-hosted path that can't be enumerated as a fixed hostname, that's still solvable (a wildcard remote pattern, or proxy uploads through `/api/images/*`) — it does not require keeping optimization off entirely.

---

## Finding 4 (MEDIUM) — No route-level loading, error, or 404 UI in the App Router

**Evidence:** zero `loading.tsx`, `error.tsx`, or `not-found.tsx` files exist anywhere under `frontend/src/app`, despite the project using Next.js App Router (which is specifically designed around these conventions).

**Why it matters:**
- Without `loading.tsx`, navigating to a data-heavy route (product detail, order history, admin dashboards) shows nothing — or a jarring blank flash — until the server component resolves. Users perceive this as the site being slow or broken, even when the actual fetch is fast.
- Without `error.tsx`, any unhandled render error in a server component falls through to Next's generic default error screen — off-brand, unhelpful, and it can't offer a "try again" action.
- Without a custom `not-found.tsx`, a mistyped or dead product URL (very common in e-commerce — expired promo links, deleted products) shows the framework default instead of "this item may have sold out — here's what's similar," which is a real recovered-sale opportunity you're leaving on the table.

**Recommended fix (concrete, minimal example):**
```tsx
// app/(shop)/products/[slug]/loading.tsx
export default function Loading() {
  return <ProductDetailSkeleton />; // reuse the pattern already proven in ReviewsSkeleton.tsx
}

// app/(shop)/products/[slug]/not-found.tsx
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-xl font-semibold">This item isn't available anymore</h1>
      <p className="mt-2 text-neutral-500">It may have sold out or been retired.</p>
      <Link href="/products" className="btn mt-6">Browse similar items</Link>
    </div>
  );
}
```
You already have the right instinct — `ReviewsSkeleton.tsx` proves the team knows how to build a skeleton loader. It just needs to be applied at the route level, not only inside one component.

---

## Finding 5 (LOW-MEDIUM) — Debug `console.log` calls shipped in `ProductCard.tsx`

**Evidence:**
```tsx
console.log('ProductCard Render:', { id: product.id, name: product.name, mounted, wishlistItemsCount, wishlisted });
...
console.log('handleWishlist Clicked:', { productId: product.id, alreadyWishlisted: wishlisted });
```
These fire on **every render of every product card** on every listing page — meaning a page with 24 products logs dozens of times per interaction. Small in isolation, but it's exactly the kind of thing that should never survive to `main`, and its presence is a signal to add a lint rule (`no-console`, allow `warn`/`error` only) rather than relying on manual review to catch the next one.

**Fix:** delete both, add `"no-console": ["warn", { allow: ["warn", "error"] }]` to the ESLint config so this can't quietly reappear.

---

## Finding 6 (LOW) — No `prefers-reduced-motion` support despite animation-heavy UI

**Evidence:** `globals.css` (1,239 lines) uses hover-transform and fade-in animations extensively (`animate-fade-in-up` on every product card, staggered by index) with no `@media (prefers-reduced-motion: reduce)` block found anywhere in the file.

**Why it matters:** this is a real accessibility requirement (WCAG 2.3.3) for users with vestibular disorders, and it's typically a single, cheap, global rule:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Add it once to `globals.css` and every existing animation respects it automatically — no per-component changes needed.

---

## E-commerce UX principles worth applying deliberately (not just bug fixes)

Beyond the concrete findings above, here's what I'd bring as an e-commerce UX specialist reviewing the *product* decisions, not just the code:

1. **Trust signals at the point of highest anxiety.** The checkout form currently has no visible security/trust messaging near the payment step (no "secured by Stripe/PayHere" badge, no SSL/lock indicator copy) — for a Sri Lankan market where card payment adoption is still building trust, this is a conversion lever, not decoration. Cheap to add, measurable to A/B test.
2. **Guest checkout should feel identical to account checkout, minus the friction — not "second-class."** You've already done the hard security work here (the F-01 fix makes guest sessions behave like real sessions). Make sure the UI doesn't undersell it — e.g., a subtle "you'll get order tracking automatically, no password needed unless you want one" reassurance reduces checkout abandonment from users unsure whether guest orders are trackable.
3. **Empty states are a conversion surface, not a dead end.** I didn't find a dedicated empty-cart or empty-wishlist illustration/CTA pattern distinct from the loading-state gaps above — an empty cart page that says "Your bag is empty" with zero recommended products is a missed cross-sell opportunity that costs nothing to add given `ProductRail.tsx` already exists for rendering product recommendations elsewhere.
4. **Quick View should never fully replace the PDP for measurement-required items.** Given this platform's core business logic requires garment measurements for `UNIFORM`/`CUSTOM` product types (verified in the backend order-validation logic), make sure `QuickViewModal` either omits the "quick add to cart" action for measurement-required products or routes them straight to the full product page — a quick-add that silently skips a mandatory measurement step is a checkout-time error waiting to happen, and worse, a customer-facing failure after they thought they'd already added the item successfully.
5. **Mobile hover-dependent affordances need a tap equivalent.** The overlay action buttons (wishlist/quick-view/visual-search icons that appear on card hover) are common on desktop-first e-commerce, but on mobile (no hover), make sure these are either always-visible on touch or triggered by tap on the card itself — worth explicitly testing on an actual phone, not just resizing a desktop browser.

---

## Priority order if you want a concrete next sprint

```text
1. Checkout form label↔input association (Finding 2)      — 1-2 hrs, zero visual risk, highest impact
2. Remove console.log + add no-console lint rule (Finding 5) — 15 min
3. prefers-reduced-motion global rule (Finding 6)           — 15 min
4. next.config.ts image remotePatterns + drop `unoptimized` — 1-2 hrs + visual QA on product images
5. loading.tsx / error.tsx / not-found.tsx for key routes   — half day, huge perceived-performance win
6. Styling-system consolidation (Finding 1)                 — ongoing, do it incrementally per component
7. UX principles above (trust signals, empty states, mobile tap affordances) — pair with a designer, A/B if possible
```

Items 1–5 are the kind of fixes that don't require a redesign conversation — they're closer to the dependency-patching work already done on the backend. Item 6 is the one structural investment worth budgeting real time for, because it's what will make items like #4 and future feature work faster to build correctly the first time.
