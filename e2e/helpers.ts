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

/** Makes a demo person look new again, so a story can walk the setup flow. Local runs only; the e2e config refuses a remote database. */
export async function markNotOnboarded(as: Persona) {
  const { createDb } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");
  const { DEMO_PERSONAS } = await import("../src/server/demo");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    await db.execute(sql`update users set onboarded_at = null, safe_word_hash = null where email = ${DEMO_PERSONAS[as]}`);
  } finally {
    await close();
  }
}
