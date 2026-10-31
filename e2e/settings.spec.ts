import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const DANIEL = "+1 (415) 555-0131";
const BAD_NUMBER = "Please enter a phone number with 7 to 15 digits, or leave it empty.";

test("Daniel adds his number in settings", async ({ page }) => {
  await signInAs(page, "daniel");
  try {
    await page.goto("/settings");
    const field = page.getByLabel("Your phone number");
    await field.fill("+1 (415) 555-0132");
    await page.getByRole("button", { name: "Save number" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Your phone number")).toHaveValue("+1 (415) 555-0132");
  } finally {
    const r = await page.request.put("/api/me/settings", { data: { phone: DANIEL } });
    expect(r.ok()).toBe(true);
  }
});

test("a bad number shows the error", async ({ page }) => {
  await signInAs(page, "daniel");
  await page.goto("/settings");
  await expect(page.getByLabel("Your phone number")).toHaveValue(DANIEL);
  await page.getByLabel("Your phone number").fill("call me");
  await page.getByRole("button", { name: "Save number" }).click();
  await expect(page.getByText(BAD_NUMBER)).toBeVisible();
  await expect(page.getByLabel("Your phone number")).toHaveValue("call me");
  const me = await (await page.request.get("/api/me")).json();
  expect(me.phone).toBe(DANIEL);
});
