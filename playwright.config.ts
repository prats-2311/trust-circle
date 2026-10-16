import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env file: the e2e test skips itself when credentials are missing
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/globalSetup.ts",
  workers: 1, // the live sandbox flows are slow and stateful
  timeout: 180_000,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run dev", url: "http://localhost:3000/demo", reuseExistingServer: true, timeout: 120_000 },
});
