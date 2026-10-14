import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PUBLIC_GAME_URL;
if (!baseURL || new URL(baseURL).protocol !== 'https:')
  throw new Error('Set PUBLIC_GAME_URL to the public HTTPS deployment URL.');

export default defineConfig({
  testDir: './tests',
  testMatch: ['production.spec.ts', 'public.spec.ts'],
  workers: 2,
  outputDir: 'test-results/public',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/public', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
