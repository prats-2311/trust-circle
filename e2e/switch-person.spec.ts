import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { PAYMENT_ID, VERIFY_ID, paymentBody, stubPayment } from "./stubs";

test("a payment screen offers Switch person", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto(`/payments/${PAYMENT_ID}`);
  await expect(page.getByRole("link", { name: "Switch person" })).toBeVisible();
});

test("Switch person from the dashboard and trends leads to the demo buttons", async ({ page }) => {
  await signInAs(page, "sarah");
  await page.goto("/circle/dashboard");
  await page.getByRole("link", { name: "Switch person" }).click();
  await expect(page).toHaveURL(/\/#try$/);
  await expect(page.getByTestId("try-margaret")).toBeVisible();
  await page.goto("/trends");
  await expect(page.getByRole("link", { name: "Switch person" })).toBeVisible();
});

test("a payment tab notices a switch instead of freezing", async ({ page }) => {
  await signInAs(page, "margaret");
  // The seeded payment is already settled, so the live answer is stubbed as a held payment until the viewer switches.
  let switched = false;
  await page.route(`**/api/payments/${PAYMENT_ID}`, (r) => (switched ? r.fallback() : r.fulfill({ json: paymentBody("held") })));
  await page.route(`**/api/payments/${PAYMENT_ID}/verification`, (r) => (switched ? r.fallback() : r.fulfill({ json: { stage: "none" } })));
  await page.goto(`/payments/${PAYMENT_ID}`);
  await expect(page.getByTestId("payment-screen-held")).toBeVisible();

  switched = true;
  await signInAs(page, "daniel");
  await expect(page.getByRole("heading", { name: "You've switched to someone else" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("This payment belongs to another person in the demo. Switch back to see it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Switch person" }).first()).toBeVisible();

  await signInAs(page, "margaret");
  await expect(page.getByRole("heading", { name: "You've switched to someone else" })).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('[data-testid^="payment-screen-"]')).toBeVisible();
});

test("the waiting screen offers See what Daniel sees", async ({ page }) => {
  await signInAs(page, "margaret");
  await stubPayment(page, "waiting");
  await page.goto(`/payments/${PAYMENT_ID}`);
  await page.getByRole("button", { name: "See what Daniel sees" }).click();
  await expect(page).toHaveURL(new RegExp(`/verify/${VERIFY_ID}$`));
  const me = await (await page.request.get("/api/me")).json();
  expect(me.persona).toBe("daniel");
});

test("the waiting screen hides the link when the person is not a demo persona", async ({ page }) => {
  await signInAs(page, "margaret");
  await stubPayment(page, "waiting");
  await page.route(`**/api/payments/${PAYMENT_ID}/verification`, (r) =>
    r.fulfill({ json: { stage: "waiting_for_person", contactName: "Alex", contactPersona: null, verificationId: VERIFY_ID, askedAt: new Date().toISOString(), challengeOpensAt: new Date(Date.now() + 36e5).toISOString() } }),
  );
  await page.goto(`/payments/${PAYMENT_ID}`);
  await expect(page.getByTestId("payment-screen-waiting")).toBeVisible();
  await expect(page.getByRole("button", { name: /See what/ })).toHaveCount(0);
});
