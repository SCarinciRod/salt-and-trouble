import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['production.spec.ts', 'public.spec.ts'],
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port 5174 --strictPort --force',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
