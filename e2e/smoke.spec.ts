import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// Runs against BASE_URL (a deployed site) or local. A cold free-tier start can take a minute, so every test gets 90 s.
// It makes no PayPal or Groq calls and changes no money state.
test.describe.configure({ timeout: 90_000 });

test("GET /api/health returns 200", async ({ request }) => {
  expect((await request.get("/api/health", { timeout: 90_000 })).status()).toBe(200);
});

test("the landing page shows the headline and the Margaret demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Scammers pretend to be someone you trust", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try as Margaret" })).toBeVisible();
});

test("the manifest is served", async ({ request }) => {
  expect((await request.get("/manifest.webmanifest", { timeout: 90_000 })).status()).toBe(200);
});

test("Margaret signs in and lands on her home", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("try-margaret").click();
  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: "Hello, Margaret" })).toBeVisible({ timeout: 30_000 });
});

test("/check shows the input form", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/check");
  await expect(page.getByLabel("The message")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("check-submit")).toBeVisible();
});

test("/send shows the form", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/send");
  await expect(page.getByLabel("Who are you paying?")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("How much?")).toBeVisible();
});

test("Sarah signs in to her circle and the dashboard grid renders", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("try-sarah").click();
  await page.waitForURL("**/circle");
  await expect(page.getByRole("heading", { name: "Your circle" })).toBeVisible({ timeout: 30_000 });
  await page.goto("/circle/dashboard");
  await expect(page.locator(".ag-root").first()).toBeVisible({ timeout: 30_000 });
});

test("/trends renders", async ({ page }) => {
  await signInAs(page, "sarah");
  await page.goto("/trends");
  await expect(page.getByRole("heading", { name: "Scams people are reporting" })).toBeVisible({ timeout: 30_000 });
});

test("an unsigned webhook is refused, not crashed", async ({ request }) => {
  const r = await request.post("/api/paypal/webhook", { data: { id: "WH-SMOKE", event_type: "PAYMENT.CAPTURE.COMPLETED" }, timeout: 90_000 });
  expect([400, 503]).toContain(r.status());
});

test("the expiry cron refuses a call with no token", async ({ request }) => {
  expect((await request.post("/api/cron/expire", { timeout: 90_000 })).status()).toBe(401);
});
