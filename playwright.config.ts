import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['line']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      ...(process.env.CHROME_EXECUTABLE ? { launchOptions: { executablePath: process.env.CHROME_EXECUTABLE } } : {}),
    },
  }],
});
