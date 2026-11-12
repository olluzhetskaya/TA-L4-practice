import { defineConfig, devices } from '@playwright/test'
import { env } from './src/config/env'
import { testTimeouts } from './src/config/timeouts'

export default defineConfig({
  globalSetup: './tests/global.setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: testTimeouts.test,
  expect: { timeout: testTimeouts.expect },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    actionTimeout: testTimeouts.action,
    navigationTimeout: testTimeouts.navigation,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'api', testDir: './tests/api', testMatch: '**/*.api.spec.ts' },
    {
      name: 'ui',
      testDir: './tests/ui',
      testMatch: '**/*.ui.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: env.uiUrl },
    },
  ],
})
