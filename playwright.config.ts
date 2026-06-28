import { defineConfig, devices } from "@playwright/test";

// E2E runs against the BUILT SPA (dist/web) served by the real CLI/server, so
// it exercises the production artifact. globalSetup copies skill/examples into a
// throwaway, gitignored workspace that the live-reload test can safely mutate.
const PORT = 4399;
// Locally we drive the installed system Chrome; in CI we install Playwright's
// bundled Chromium and select it by leaving the channel unset.
const CHANNEL = process.env.PW_CHANNEL === "chromium" ? undefined : "chrome";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./test/e2e/global-setup.ts",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    channel: CHANNEL,
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: CHANNEL } }],
  // The server is spawned + torn down by test/e2e/global-setup.ts (deterministic
  // cross-platform teardown — Playwright's webServer can't reliably stop the CLI
  // on Windows).
});
