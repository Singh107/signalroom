import { defineConfig } from '@playwright/test'
import { chromiumLaunchOptions } from 'deepspace/testing'

// Explicit opt-in: creates clearly labeled synthetic records in production.
// No local server, auth bypass, cleanup privilege, or fixture credentials here.
export default defineConfig({
  testDir: '.',
  testMatch: ['dashboard-demo.spec.ts', 'smoke.spec.ts'],
  grep: /reviewer demo supports|demo rooms reject|demo requires|static landing loads|landing carries|static contract/,
  outputDir: '../.deepspace/production-test-results',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'https://signalroom-singh107.app.space',
    headless: true,
    launchOptions: chromiumLaunchOptions(),
    trace: 'off',
    video: 'off',
  },
})
