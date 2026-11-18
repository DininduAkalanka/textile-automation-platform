import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { localUrl } from './e2e-playwright/fixtures/guards';

const ci = Boolean(process.env.CI);
const baseURL = localUrl(process.env.PW_BASE_URL ?? 'http://127.0.0.1:3000', 'PW_BASE_URL');
const apiURL = localUrl(process.env.PW_API_URL ?? 'http://127.0.0.1:3001/api/v1', 'PW_API_URL');
const sharded = process.argv.some((arg) => arg === '--shard' || arg.startsWith('--shard='));
const reporters: ReporterDescription[] = ci
  ? [['github'], ['html', { open: 'never' }]]
  : [['list']];
if (sharded) reporters.push(['blob']);

export default defineConfig({
  testDir: './e2e-playwright/specs',
  metadata: { apiURL },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  forbidOnly: ci,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: reporters,
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', grep: /@cross-browser\b/, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', grep: /@mobile\b/, use: { ...devices['Pixel 7'] } },
    ...(process.env.PW_FIREFOX === '1'
      ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }]
      : []),
  ],
});
