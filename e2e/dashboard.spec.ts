import { expect, test } from "@playwright/test";

const SARAH = process.env.NEXT_PUBLIC_DEMO_CONTACT_ID!;
test.skip(!SARAH, "demo contact id not set");

test.beforeEach(async ({ page }) => {
  const r = await page.request.post("/api/demo/login", { data: { userId: SARAH } });
  expect(r.ok()).toBe(true);
});

test("the trusted contact sees protected money and stopped scams in the grid", async ({ page }) => {
  await page.goto("/circle/dashboard");
  await expect(page.getByTestId("money-protected")).toContainText("$");
  await expect(page.locator(".ag-root").first()).toBeVisible();
  await expect(page.getByTestId("status-stopped").first()).toHaveText("Stopped");
  await page.getByLabel("Search payments").fill("lotto");
  await expect(page.getByTestId("status-hold_ended")).toHaveCount(1);
});

test("a tapped row opens a details panel with every reason", async ({ page }) => {
  await page.goto("/circle/dashboard");
  await page.getByTestId("status-stopped").first().click();
  const panel = page.getByTestId("payment-details");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close" })).toBeVisible();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
});

test("the trends page draws the chart and the totals table", async ({ page }) => {
  await page.goto("/trends");
  await expect(page.getByTestId("trends-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByText("Family member in trouble").first()).toBeVisible();
});
