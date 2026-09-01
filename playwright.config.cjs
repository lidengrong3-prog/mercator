const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.cjs',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: process.env.JAY_PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.JAY_PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'python -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
});
