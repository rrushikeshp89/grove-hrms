import { defineConfig, devices } from "@playwright/test";

/**
 * Checks a deployed site from the outside. No local server, no reseed, and
 * nothing it does outlives the test.
 *
 *   npm run test:live
 *   LIVE_URL=https://example.com npm run test:live
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["live.spec.ts", "sweep.spec.ts"],
  expect: { timeout: 15_000 },
  timeout: 90_000,
  fullyParallel: true,
  workers: 3,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.LIVE_URL ?? "https://grove-hrms.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
