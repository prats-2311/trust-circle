import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const MARGARETS_PAYMENT = "00000000-0000-4000-a000-000000000003"; // from npm run seed:history

test("someone else's payment shows a calm not-found screen", async ({ page }) => {
  await signInAs(page, "robert");
  await page.goto(`/payments/${MARGARETS_PAYMENT}`);
  await expect(page.getByRole("heading", { name: "We couldn't find this payment" })).toBeVisible();
  await page.goto(`/circle/payments/${MARGARETS_PAYMENT}`);
  await expect(page.getByRole("heading", { name: "We couldn't find this payment" })).toBeVisible();
});

test("a signed-out visitor is offered the demo accounts", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Choose a demo account" })).toBeVisible();
});
