import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DB = "file:./e2e.db";

/**
 * End-to-end tests run against a production build (`npm run build` first) with a fresh, empty database.
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium instead of Playwright's download.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `rm -f prisma/e2e.db prisma/e2e.db-journal && DATABASE_URL=${DB} npx prisma migrate deploy && DATABASE_URL=${DB} npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
