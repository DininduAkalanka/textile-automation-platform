import { test as base, expect } from '@playwright/test';
import { guardNetwork } from './guards';

export const test = base.extend<{ localNetwork: void }>({
  localNetwork: [async ({ context, baseURL }, use, testInfo) => {
    if (!baseURL) throw new Error('Missing Playwright baseURL');
    const unexpected = await guardNetwork(context, baseURL, String(testInfo.project.metadata.apiURL));
    await use();
    expect(unexpected, 'Unapproved remote requests').toEqual([]);
  }, { auto: true }],
});

export { expect };
