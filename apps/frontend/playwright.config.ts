import { defineConfig, devices } from "@playwright/test"

const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  // A stray test.only would silently skip the rest of the suite in CI.
  forbidOnly: isCI,
  // In CI, keep a report and traces of failed tests to download from the run.
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3050", trace: isCI ? "retain-on-failure" : "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
