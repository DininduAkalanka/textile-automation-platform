import { test, expect } from '../../fixtures/test';

/**
 * Pre-handover: a signed-in customer (or shop owner) can change their own
 * password from the account menu, and the account pages carry the normal
 * site header and footer (they used to render with no navigation at all).
 */
test('a customer changes their password from the account menu @critical', async ({ page, request }, testInfo) => {
  const api = String(testInfo.project.metadata.apiURL);
  const stamp = Date.now();
  const email = `pw-change-${stamp}@example.test`;
  const oldPassword = 'Original#Pass1';
  const newPassword = 'Brand-New#Pass2';

  const registered = await request.post(`${api}/auth/register`, {
    data: { email, password: oldPassword, firstName: 'Pass', lastName: 'Changer' },
    headers: { 'X-Forwarded-For': `10.98.${(stamp >> 8) & 255}.${stamp & 255}` },
  });
  expect(registered.status(), await registered.text()).toBe(201);

  // Sign in through the real login page.
  await page.goto('/login');
  await page.getByTestId('login-identifier-input').fill(email);
  await page.getByTestId('login-password-input').fill(oldPassword);
  await page.getByTestId('login-submit-btn').click();
  await expect(page).not.toHaveURL(/\/login/);

  // Reach the page from the account menu, as a customer would.
  await page.goto('/');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('link', { name: 'Change Password' }).first().click();
  await expect(page).toHaveURL(/\/account\/security$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Change Password' })).toBeVisible();

  // Account pages now have the site navigation.
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  // A wrong current password is refused with a clear message.
  await page.getByTestId('current-password').fill('not-my-password');
  await page.getByTestId('new-password').fill(newPassword);
  await page.getByTestId('confirm-password').fill(newPassword);
  await page.getByTestId('change-password-submit').click();
  await expect(page.getByTestId('change-password-error')).toContainText('current password is not correct');

  // The real change succeeds and the customer stays signed in.
  await page.getByTestId('current-password').fill(oldPassword);
  await page.getByTestId('change-password-submit').click();
  await expect(page.getByTestId('change-password-success')).toBeVisible();
  await page.goto('/account/orders');
  await expect(page.getByRole('heading', { level: 1, name: 'My Orders' })).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();

  // Only the new password works now.
  const oldLogin = await request.post(`${api}/auth/login`, { data: { identifier: email, password: oldPassword } });
  expect(oldLogin.status()).toBe(401);
  const newLogin = await request.post(`${api}/auth/login`, { data: { identifier: email, password: newPassword } });
  expect(newLogin.status()).toBe(201);
});
