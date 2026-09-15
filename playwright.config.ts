import { defineConfig } from '@playwright/test';

// End-to-end tests run in the installed Microsoft Edge at a phone-sized viewport, against a web
// build made at the start of every run from the current code: a leftover server or an old export
// can never be what gets tested. Maps need internet; walking routes are answered by the tests.
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
    command: `npx expo export --platform web --output-dir dist-e2e && npx serve -s dist-e2e -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
