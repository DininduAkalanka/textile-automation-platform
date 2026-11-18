import type { Response } from '@playwright/test';
import { test, expect } from '../../fixtures/test';

test('home and catalog show seeded products to an anonymous shopper @smoke', async ({ page }, testInfo) => {
  const api = String(testInfo.project.metadata.apiURL);
  const refreshUrl = api + '/auth/refresh';
  const refreshResponses: Response[] = [];
  const errors: string[] = [];
  let refreshConsoleErrors = 0;
  page.on('response', (response) => {
    if (response.url() === refreshUrl) refreshResponses.push(response);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.location().url === refreshUrl &&
        message.text() === 'Failed to load resource: the server responded with a status of 401 (Unauthorized)') {
      refreshConsoleErrors++;
    } else {
      errors.push(`${message.text()} at ${message.location().url}`);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Main Banner Slider' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Nandana Textile/);

  const listing = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return res.request().method() === 'GET' && url.origin + url.pathname === api + '/products';
  });
  await page.getByRole('link', { name: 'View All Departments' }).click();
  await expect(page).toHaveURL(new URL('/products', String(testInfo.project.use.baseURL)).href);
  expect((await listing).status(), 'Catalog API response').toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: /Our Collection/ })).toBeVisible();

  const products = [
    ['Border Detailed Handloom Saree', 'border-detailed-handloom-saree'],
    ['Engage Long Sleeve Striped Workwear Shirt', 'engage-long-sleeve-striped-shirt'],
  ];
  for (const [name, slug] of products) {
    const nameLink = page.getByRole('article').getByText(name, { exact: true });
    await expect(nameLink).toBeVisible();
    await expect(nameLink).toHaveAttribute('href', `/products/${slug}`);
  }

  expect(errors, 'Unexpected browser errors').toEqual([]);
  expect(refreshConsoleErrors, 'At most one anonymous session probe').toBeLessThanOrEqual(1);
  expect(refreshResponses.length, 'No repeated refresh on shop navigation').toBeLessThanOrEqual(1);
  if (refreshConsoleErrors) {
    expect(refreshResponses, 'Match the console error to an actual API response').toHaveLength(1);
    const [refresh] = refreshResponses;
    expect(refresh.status()).toBe(401);
    expect(refresh.request().method()).toBe('POST');
    const headers = await refresh.request().allHeaders();
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  }
});
