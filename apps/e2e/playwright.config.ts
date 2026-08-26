import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { ORIGIN } from './steps/origins';

function featureGlob(): string {
  const raw = process.env.MEMRIES_E2E_FEATURE?.trim();
  if (!raw) return 'features/**/*.feature';
  const file = raw.replace(/^features\//, '');
  return `features/${file}`;
}

const bddDir = defineBddConfig({
  features: featureGlob(),
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen',
  tags: 'not @future',
});

export default defineConfig({
  testDir: bddDir,
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: ORIGIN,
    locale: 'en-GB',
    timezoneId: 'UTC',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-touch',
      use: { ...devices['Pixel 5'], hasTouch: true },
    },
  ],
  webServer: {
    command: 'node scripts/stack.mjs up',
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
