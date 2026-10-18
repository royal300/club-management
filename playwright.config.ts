import { defineConfig, devices } from "@playwright/test";

/**
 * Two modes:
 *  - Local (default): resets a throwaway `club_test` database, then runs the production
 *    build on :3100 against it. Every flow, including writes, is exercised.
 *  - Live smoke: E2E_BASE_URL=https://club.rasatech.in E2E_SMOKE=1 — read-only checks
 *    against a deployed site (never writes to real club books).
 */
const live = !!process.env.E2E_BASE_URL;
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: live ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      testIgnore: [/auth\.setup\.ts/, /mobile\.spec\.ts/],
      grep: live ? /@smoke/ : undefined,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: live
    ? undefined
    : {
        command: "npx next start -p 3100",
        url: "http://localhost:3100/login",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? "mysql://club_app:club_dev_password@127.0.0.1:3307/club_test",
          APP_URL: "http://localhost:3100",
          UPLOAD_DIR: "./.data/test-uploads",
          UPLOAD_MAX_MB: "5",
        },
      },
});
