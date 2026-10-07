import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They need the local Supabase stack (`npx supabase start`)
 * and `.env.local` (copy `.env.example`). By default Playwright builds and
 * starts the app; set E2E_BASE_URL to test an already-running server instead.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
// Use a specific Chromium binary, e.g. when the bundled browser can't be downloaded.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: `${baseURL}/games`,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
