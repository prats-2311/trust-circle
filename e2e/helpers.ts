import { expect, type Page } from "@playwright/test";
import type { Persona } from "../src/server/demo";

export async function signInAs(page: Page, as: Persona) {
  const r = await page.request.post("/api/demo/login", { data: { as } });
  expect(r.ok()).toBe(true);
}

export async function approveInPayPal(page: Page) {
  const email = process.env.SANDBOX_SENIOR_EMAIL!;
  const password = process.env.SANDBOX_SENIOR_PASSWORD!;
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("paypal-button").click();
  const popup = await popupPromise;
  await popup.getByRole("textbox", { name: /email or mobile number/i }).fill(email);
  await popup.getByRole("button", { name: /^next$/i }).click();
  await popup.locator("#password").fill(password);
  await popup.getByRole("button", { name: /log in/i }).click();
  await popup.getByRole("button", { name: /(complete purchase|continue)/i }).click();
  await popup.waitForEvent("close");
}
