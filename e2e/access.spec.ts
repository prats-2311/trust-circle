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

test("Priya is a business sender with Tom as her accountant", async ({ page }) => {
  await signInAs(page, "priya");
  const r = await page.request.get("/api/me");
  expect(r.status()).toBe(200);
  const me = await r.json();
  expect(me.persona).toBe("priya");
  expect(me.preset).toBe("business");
  expect(me.circle).toEqual([{ displayName: "Tom", relationship: "accountant" }]);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Choose a demo account" })).not.toBeVisible();
});

test("Tom signs in as Priya's accountant", async ({ page }) => {
  await signInAs(page, "tom");
  const r = await page.request.get("/api/me");
  expect(r.status()).toBe(200);
  const me = await r.json();
  expect(me.persona).toBe("tom");
  expect(me.lookingAfter).toEqual([{ displayName: "Priya", relationship: "accountant" }]);
});

test("Robert is the solo account with no circle", async ({ page }) => {
  await signInAs(page, "robert");
  const me = await (await page.request.get("/api/me")).json();
  expect(me.preset).toBe("solo");
  expect(me.circle).toEqual([]);
});
