import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no local env file: the e2e test skips itself when credentials are missing
}

// BASE_URL points the run at a deployed site. Then no dev server starts and the demo is never reset, so tests
// can't wipe data on a remote database.
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: remote ? undefined : "./e2e/globalSetup.ts",
  workers: 1, // the live sandbox flows are slow and stateful
  timeout: 180_000,
  use: { baseURL: remote ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    // Against a deployed site only the smoke test runs; the stories reset data and move sandbox money.
    { name: "default", testIgnore: remote ? "**" : "smoke.spec.ts" },
    { name: "smoke", testMatch: "smoke.spec.ts" },
  ],
  webServer: remote ? undefined : { command: "npm run dev", url: "http://localhost:3000/demo", reuseExistingServer: true, timeout: 120_000 },
});
