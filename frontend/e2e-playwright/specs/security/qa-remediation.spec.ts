import { resolve } from 'node:path';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * QA remediation — browser regression (independent QA report, 2026-11-19).
 *
 * P1-10 is the reason this file exists: it opens the storefront from a
 * NON-production hostname and proves the browser never talks to the live
 * production API. Chromium's --host-resolver-rules maps a staging-style name
 * onto the local stack, so the page really runs on "staging.nandana.test".
 * The build under test must NOT set NEXT_PUBLIC_API_URL for that check to mean
 * anything (the runtime fallback is what used to send traffic to production);
 * the test skips itself, loudly, when it can tell the build pinned the URL.
 *
 * Network rule for every test here: the local stack only. Images and fonts
 * from catalogue CDNs get a local placeholder; any other off-stack request —
 * production API, payment gateway, anything — is aborted and fails the test.
 */

const STAGING_HOST = 'staging.nandana.test';
const placeholder = resolve(__dirname, '../../../public/images/prod1.png');

async function guard(context: BrowserContext, allowedHosts: string[]) {
  const offStack: string[] = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (allowedHosts.includes(url.hostname)) return route.continue();
    if (req.method() === 'GET' && req.resourceType() === 'image') {
      return route.fulfill({ path: placeholder, contentType: 'image/png' });
    }
    if (req.method() === 'GET' && (req.resourceType() === 'stylesheet' || req.resourceType() === 'font')) {
      return route.fulfill({ contentType: 'text/css', body: '/* local QA: system fonts */' });
    }
    offStack.push(`${req.method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  return offStack;
}

const test = base.extend<{ offStack: string[] }>({
  offStack: [
    async ({ context }, use) => {
      const offStack = await guard(context, ['127.0.0.1', 'localhost']);
      await use(offStack);
      expect(offStack, 'requests that left the local stack').toEqual([]);
    },
    { auto: true },
  ],
});

test.use({
  launchOptions: { args: [`--host-resolver-rules=MAP ${STAGING_HOST} 127.0.0.1`] },
});

const apiURL = () => String(test.info().project.metadata.apiURL);
const lkPhone = () => `077${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`;
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 10_000)}`;

async function readyProductSlug(page: Page): Promise<{ id: string; slug: string }> {
  const res = await page.request.get(`${apiURL()}/products?limit=100`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const products = json.data?.products ?? json.data;
  const product = products.find(
    (p: any) => !p.requiresMeasurement && p.stockQuantity > 5 && !p.attributes?.sizeStock,
  );
  expect(product, 'an in-stock ready-made product').toBeTruthy();
  return product;
}

async function addToCartAndFillCheckout(page: Page, contact: { email: string; phone: string }) {
  const product = await readyProductSlug(page);
  await page.goto(`/products/${product.slug}`);
  await page.getByTestId('add-to-cart-btn').click();
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: /Express Checkout/i })).toBeVisible();
  await page.getByTestId('checkout-name-input').fill('QA Playwright Buyer');
  await page.getByTestId('checkout-email-input').fill(contact.email);
  await page.getByTestId('checkout-phone-input').fill(contact.phone);
  await page.getByTestId('checkout-address1-input').fill('12 Galle Road');
  await page.getByTestId('checkout-city-input').fill('Colombo');
  await page.getByTestId('checkout-state-input').fill('Western Province');
  await page.getByTestId('checkout-postal-input').fill('00300');
  await page.getByTestId('checkout-country-input').fill('Sri Lanka');
  await page.getByTestId('checkout-continue-to-payment-btn').click();
}

test('P1-10: a non-production hostname never calls the live production API @critical @security', async ({ browser }) => {
  test.skip(test.info().project.name !== 'chromium', 'host mapping is a Chromium launch flag');

  const context = await browser.newContext();
  const offStack = await guard(context, [STAGING_HOST, '127.0.0.1', 'localhost']);
  const apiCalls: string[] = [];
  context.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/v1/')) apiCalls.push(url.origin);
  });

  const page = await context.newPage();
  await page.goto(`http://${STAGING_HOST}:3000/products`);
  await expect(page.getByRole('heading', { level: 1, name: /Our Collection/ })).toBeVisible();
  await page.waitForLoadState('networkidle');

  // The old code rewrote this to https://textile-automation-platform.onrender.com.
  expect(offStack.filter((r) => /onrender\.com/.test(r)), 'live API requests').toEqual([]);
  expect(offStack, 'requests that left the local stack').toEqual([]);

  const origins = [...new Set(apiCalls)];
  test.skip(
    origins.length > 0 && origins.every((o) => o === new URL(apiURL()).origin),
    'This build pins NEXT_PUBLIC_API_URL, so the runtime fallback is not exercised. Build without it to run this check.',
  );
  // No NEXT_PUBLIC_API_URL: the browser uses the API on its own host.
  expect(origins).toEqual([`http://${STAGING_HOST}:3001`]);
  await context.close();
});

test('P0-1: a guest using an existing account email is told to sign in, not logged in @critical @security', async ({ page }) => {
  await addToCartAndFillCheckout(page, { email: 'customer@example.com', phone: lkPhone() });
  await page.getByTestId('payment-method-payhere').click();
  await page.getByTestId('checkout-continue-to-review-btn').click();

  const guest = page.waitForResponse((r) => r.url().endsWith('/orders/guest-checkout'));
  await page.getByTestId('checkout-place-order-btn').click();
  const res = await guest;
  expect(res.status()).toBe(409);
  const json = await res.json();
  expect(json.error.code).toBe('LOGIN_REQUIRED');
  expect(JSON.stringify(json)).not.toMatch(/accessToken/);

  await expect(page.getByTestId('checkout-error')).toContainText('already exists');
  await expect(page.getByTestId('checkout-login-required-signin')).toHaveAttribute(
    'href',
    '/login?returnTo=/checkout',
  );
  expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
});

test('P1-8: a guest pays Cash on Delivery end to end (code → verified → confirmed) @critical', async ({ page }) => {
  const email = `qa_pw_cod_${uniq()}@example.com`;
  await addToCartAndFillCheckout(page, { email, phone: lkPhone() });
  await page.getByTestId('payment-method-cod').click();
  await page.getByTestId('checkout-continue-to-review-btn').click();

  const codeSent = page.waitForResponse((r) => r.url().endsWith('/orders/guest-checkout/send-code'));
  await page.getByTestId('checkout-place-order-btn').click();
  expect((await codeSent).status()).toBe(201);
  await expect(page.getByTestId('checkout-otp-hint')).toContainText(email);

  // Non-production stacks accept the development bypass code.
  await page.getByTestId('checkout-otp-input').fill('123456');
  const placed = page.waitForResponse(
    (r) => r.url().endsWith('/orders/guest-checkout') && r.request().method() === 'POST' && r.status() !== 400,
  );
  await page.getByTestId('checkout-verify-confirm-btn').click();
  const res = await placed;
  expect(res.status()).toBe(201);
  const { data } = await res.json();
  expect(data.order.status).toBe('CONFIRMED');
  expect(data.order.payment.method).toBe('COD');
  expect(data.session.user.emailVerified).toBe(true);

  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]{36}\?success=true/);
  await expect(page.getByText(/Order Placed Successfully/i)).toBeVisible();
});

test('P0-1 / P1-7 / P1-2: API guards hold against the report\'s payloads @critical @security', async ({ request }) => {
  const products = (await (await request.get(`${apiURL()}/products?limit=100`)).json()).data.products;
  const product = products.find((p: any) => !p.requiresMeasurement && p.stockQuantity > 5 && !p.attributes?.sizeStock);
  const address = {
    fullName: 'QA', addressLine1: '1 Road', city: 'Colombo', state: 'Western', postalCode: '00100', country: 'LK',
  };

  // P0-1: the admin email gets no session.
  const takeover = await request.post(`${apiURL()}/orders/guest-checkout`, {
    data: {
      items: [{ productId: product.id, quantity: 1 }],
      shippingAddress: address,
      email: 'admin@textileshop.com',
      phone: lkPhone(),
      fullName: 'Attacker',
      paymentMethod: 'PAYHERE',
    },
  });
  expect(takeover.status()).toBe(409);
  expect(JSON.stringify(await takeover.json())).not.toMatch(/accessToken/);

  // P0-2: the report's quantity-30 single request.
  const hoard = await request.post(`${apiURL()}/orders/guest-checkout`, {
    data: {
      items: [{ productId: product.id, quantity: 30 }],
      shippingAddress: address,
      email: `qa_pw_${uniq()}@example.com`,
      phone: lkPhone(),
      fullName: 'Hoarder',
      paymentMethod: 'PAYHERE',
    },
  });
  expect(hoard.status()).toBe(400);

  // P1-7 / P1-2 as a signed-in customer.
  const login = await request.post(`${apiURL()}/auth/login`, {
    data: { identifier: 'customer@example.com', password: 'Customer@123456' },
  });
  const token = (await login.json()).data.accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  const order = (
    await (
      await request.post(`${apiURL()}/orders`, {
        headers: auth,
        data: { items: [{ productId: product.id, quantity: 1 }], shippingAddress: address },
      })
    ).json()
  ).data;

  for (const installmentCount of [0, -2, 2.5, 500, 'abc']) {
    const res = await request.post(`${apiURL()}/payments/installments/create`, {
      headers: auth,
      data: { orderId: order.id, installmentCount },
    });
    expect(res.status(), `installmentCount ${installmentCount}`).toBe(400);
  }

  await request.put(`${apiURL()}/orders/${order.id}/cancel`, { headers: auth, data: {} });
  const cod = await request.post(`${apiURL()}/payments/cod`, { headers: auth, data: { orderId: order.id } });
  expect(cod.status()).toBe(400);
  expect((await cod.json()).error.code).toBe('ORDER_NOT_PAYABLE');
});
