import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { approveInPayPal, signInAs } from "./helpers";

const GRANDSON = process.env.SANDBOX_GRANDSON_EMAIL!;
test.skip(!process.env.SANDBOX_SENIOR_EMAIL || !process.env.SANDBOX_SENIOR_PASSWORD || !GRANDSON, "sandbox credentials not set");

// The first story reports the grandson's account to the shared scam list; a clean slate keeps the second story independent of it.
test.beforeEach(() => {
  execSync("npm run demo:reset", { stdio: "ignore" });
});

test("a grandson scam is held, the real Daniel says it wasn't him, and the money is safe", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByTestId("try-margaret").click();
  await page.waitForURL("**/home");
  await page.getByTestId("home-send").click();
  await page.getByLabel("Who are you paying?").fill(GRANDSON);
  await page.getByLabel("How much?").fill("800");
  await page.getByLabel("Who asked you to make this payment, and why?").fill(
    "My grandson Daniel called crying, he's in jail and needs bail money today. He said not to tell his mum.",
  );
  await page.getByTestId("check").click();
  await expect(page.getByTestId("risk-high")).toBeVisible();
  await approveInPayPal(page);
  await page.waitForURL("**/payments/**");
  await expect(page.locator("[data-testid=payment-screen-waiting], [data-testid=payment-screen-held]")).toBeVisible();

  const daniel = await browser.newPage();
  await signInAs(daniel, "daniel");
  await daniel.goto("/circle");
  await daniel.getByTestId("answer-verification").first().click();
  await daniel.getByTestId("not-me").click();
  await expect(daniel.getByRole("heading", { name: /We stopped it/ })).toBeVisible();

  await expect(page.getByTestId("payment-screen-stopped_by_person")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Payment stopped. Your money is safe." })).toBeVisible();
});

test("a small payment to someone new is confirmed and paid out", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/send");
  await page.getByLabel("Who are you paying?").fill(GRANDSON);
  await page.getByLabel("How much?").fill("20");
  await page.getByTestId("check").click();
  const medium = page.getByTestId("confirm-medium");
  if (await medium.isVisible().catch(() => false)) await medium.click();
  await approveInPayPal(page);
  await page.waitForURL("**/payments/**");
  await expect(page.getByTestId("payment-screen-sent")).toBeVisible({ timeout: 30_000 });
});
