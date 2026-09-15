import { defineConfig } from '@playwright/test';

// End-to-end tests run against the exported web build (npm run test:e2e builds it first),
// in the installed Microsoft Edge at a phone-sized viewport. Maps and walking routes need internet.
const PORT = 5091;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'msedge',
    viewport: { width: 390, height: 844 },
    locale: 'en-GB',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx serve -s dist-e2e -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
