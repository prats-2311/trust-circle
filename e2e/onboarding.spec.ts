import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("Margaret finishes setup from home and her safe word is saved", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/home");
  await expect(page.getByTestId("setup-card")).toBeVisible();
  await page.getByTestId("setup-start").click();

  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Who are you protecting?" })).toBeVisible();
  await page.getByTestId("preset-family").check();
  await page.getByTestId("onboarding-next").click();

  await expect(page.getByRole("heading", { name: "Who checks risky payments" })).toBeVisible();
  await page.getByTestId("onboarding-next").click();

  await expect(page.getByRole("heading", { name: "Choose a family safe word" })).toBeVisible();
  await page.getByLabel("Safe word").fill("bluebird");
  await page.getByTestId("onboarding-next").click();

  await expect(page.getByRole("heading", { name: "Turn on alerts" })).toBeVisible();
  await expect(page.getByTestId("notifications")).toHaveAttribute("data-state", /^(unsupported|server_off|ask|ios_needs_install)$/);
  await page.getByTestId("onboarding-next").click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByTestId("setup-card")).toHaveCount(0);
  const me = await (await page.request.get("/api/me")).json();
  expect(me.safeWordSet).toBe(true);
  expect(me.onboarded).toBe(true);
});

test("a cooling-off choice in settings is kept", async ({ page }) => {
  await signInAs(page, "robert");
  try {
    await page.goto("/settings");
    await page.getByTestId("cooling-12").check();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("cooling-12")).toBeChecked();
  } finally {
    const r = await page.request.put("/api/me/settings", { data: { coolingOffHours: 24 } });
    expect(r.ok()).toBe(true);
  }
});
