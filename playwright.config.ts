import { defineConfig } from '@playwright/test'
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('Smoke tests create local fixtures and only run against a loopback address.')
}
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
})
