import { test, expect } from '../../fixtures/test';

/**
 * Pre-handover UX audit regressions (2026-11-19).
 *
 * A live crawl of the shop found links that went nowhere ("#"), pages that did
 * not exist (/privacy, /terms), a contact form that pretended to send, and
 * promotions the checkout could not honour. Each test below pins one of those
 * fixes so it cannot quietly come back.
 */

const SHOP_WHATSAPP = 'https://wa.me/94717088445';

test('every header and footer link leads somewhere real @smoke', async ({ page, request }, testInfo) => {
  const base = String(testInfo.project.use.baseURL);
  await page.goto('/');

  const links = await page.locator('header a[href], footer a[href]').evaluateAll((as) =>
    as.map((a) => ({ text: (a.textContent || a.getAttribute('aria-label') || '').trim(), href: a.getAttribute('href') ?? '' })),
  );
  expect(links.length).toBeGreaterThan(20);

  const dead = links.filter((l) => l.href === '' || l.href === '#' || l.href.startsWith('javascript:'));
  expect(dead, 'links that go nowhere').toEqual([]);

  const internal = [...new Set(links.map((l) => l.href).filter((h) => h.startsWith('/')))].map((h) => h.split('#')[0] || '/');
  for (const path of [...new Set(internal)]) {
    const res = await request.get(new URL(path, base).href);
    expect(res.status(), `${path} should open a page`).toBe(200);
  }

  const footer = page.locator('footer');
  await expect(footer.locator('a[href^="tel:"]').first()).toBeVisible();
  await expect(footer.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(footer.getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/nandanatextiles/');
});

test('the customer-information pages exist and have content', async ({ page }) => {
  for (const [path, title] of [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/shipping', 'Shipping & Delivery'],
    ['/size-guide', 'Size & Fit Guide'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('article section').first()).toBeVisible();
  }

  await page.goto('/contact#faq');
  await expect(page.locator('#faq').getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
});

test('the contact form hands the message to WhatsApp instead of faking success', async ({ page, context }) => {
  // Never actually load WhatsApp from the test.
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'whatsapp stub' }));
  await page.goto('/contact');

  const form = page.locator('form').filter({ has: page.getByRole('button', { name: /Continue on WhatsApp/ }) });
  await form.getByPlaceholder('Kasun Perera').fill('Test Shopper');
  await form.getByPlaceholder('Brief summary of your inquiry').fill('Size question');
  await form.locator('textarea').fill('Do you have the oxford shirt in XL?');

  const popupPromise = page.waitForEvent('popup');
  await form.getByRole('button', { name: /Continue on WhatsApp/ }).click();
  const popup = await popupPromise;

  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe(SHOP_WHATSAPP);
  expect(url.searchParams.get('text')).toContain('Subject: Size question');
  expect(url.searchParams.get('text')).toContain('Do you have the oxford shirt in XL?');
  await expect(page.getByRole('status')).toContainText('ready in WhatsApp');
  await expect(page.getByText('Message Received')).toHaveCount(0);
});

test('no promotion, service or branch the shop cannot honour is advertised', async ({ page }) => {
  const FALSE_CLAIMS = [
    /NANDANA20/i,
    /\bkoko\b/i,
    /mintpay/i,
    /payzy/i,
    /search by image/i,
    /above\s+Rs\.?\s*5,000/i, // delivery is free on every order
    /kurunegala/i, // the only showroom is in Veyangoda
    /pickup code/i, // no automatic pickup notification exists
  ];
  const check = async (where: string) => {
    const text = await page.locator('body').innerText();
    for (const claim of FALSE_CLAIMS) {
      expect(text, `${where} must not advertise ${claim}`).not.toMatch(claim);
    }
  };

  for (const path of ['/', '/cart', '/contact', '/returns-exchange', '/shipping']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await check(path);
  }

  // Product cards load after the page itself: wait for them before reading.
  await page.goto('/products');
  const firstCard = page.getByRole('article').first();
  await expect(firstCard).toBeVisible();
  await check('/products (with product cards)');

  // A product page, including its "View store information" popup.
  await firstCard.locator('a[href^="/products/"]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await check('product page');
  const storeInfo = page.getByRole('button', { name: /view store information/i });
  if (await storeInfo.count()) {
    await storeInfo.click();
    // exact: the page also says "Collect Your Order from Our Showroom", and a
    // substring match hit both (strict-mode failure in every nightly run).
    await expect(page.getByText('Our Showroom', { exact: true })).toBeVisible();
    await check('product page store popup');
  }

  await expect(page.getByRole('button', { name: /search by image/i })).toHaveCount(0);
});

test('the footer shows the one real showroom with a working map link', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('footer a[href^="https://www.google.com/maps/search/"]');
  await expect(map).toHaveCount(1);
  await expect(map).toContainText('50 Main St, Veyangoda 11100');
  const query = new URL((await map.getAttribute('href'))!).searchParams.get('query');
  expect(query).toBe('Nandana Textiles, 50 Main St, Veyangoda 11100');
});

test('Shop the Look only shows real, openable products', async ({ page, request }, testInfo) => {
  // The section loads its products after the page renders, and hides itself
  // when the corporate collection has fewer than 2 suitable products. Ask the
  // API which case applies, then assert that case.
  const api = String(testInfo.project.metadata.apiURL);
  const res = await request.get(`${api}/products?categorySlug=corporate-uniforms&limit=12`);
  const body = await res.json();
  const items: { stockQuantity: number }[] = body.data?.products ?? [];
  const usable = items.filter((p) => p.stockQuantity > 0).length;

  await page.goto('/');
  const section = page.locator('#shop-the-look');
  if (usable < 2) {
    await page.waitForLoadState('networkidle');
    await expect(section).toHaveCount(0);
    return;
  }
  await expect(section).toBeVisible();

  const hrefs = await section.locator('a[href^="/products/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThanOrEqual(2);
  await page.goto(hrefs[0]);
  await expect(page.getByText('Product Not Found')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
