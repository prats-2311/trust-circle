import { expect, test } from "@playwright/test";

const BUYER_EMAIL = process.env.SANDBOX_SENIOR_EMAIL!;
const BUYER_PASSWORD = process.env.SANDBOX_SENIOR_PASSWORD!;
const GRANDSON = process.env.SANDBOX_GRANDSON_EMAIL!;

test.skip(!BUYER_EMAIL || !BUYER_PASSWORD || !GRANDSON, "sandbox credentials not set");

async function approveInPayPal(page: import("@playwright/test").Page) {
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("paypal-button").click();
  const popup = await popupPromise;
  await popup.getByLabel(/email/i).fill(BUYER_EMAIL);
  await popup.getByRole("button", { name: /next/i }).click().catch(() => undefined);
  await popup.getByLabel(/password/i).fill(BUYER_PASSWORD);
  await popup.getByRole("button", { name: /log in/i }).click();
  await popup.getByRole("button", { name: /(pay|continue|complete)/i }).first().click();
  await popup.waitForEvent("close");
}

test("a scam payment is held and the trusted contact blocks it", async ({ page }) => {
  await page.goto("/demo");
  await page.getByTestId("demo-send").click();
  await page.getByTestId("payee").fill(GRANDSON);
  await page.getByTestId("amount").fill("800");
  await page.getByTestId("answer").fill("My grandson called crying, he's in jail and needs bail money today. He said not to tell his mum.");
  await page.getByTestId("check").click();
  await expect(page.getByTestId("risk-high")).toBeVisible();
  await approveInPayPal(page);
  await expect(page.getByTestId("payment-state")).toHaveText("held");

  await page.goto("/demo");
  await page.getByTestId("demo-circle").click();
  await expect(page.getByTestId("held-payment").first()).toBeVisible();
  await page.getByTestId("block").first().click();
  await expect(page.getByTestId("decision-result")).toHaveText("Payment voided");
});
