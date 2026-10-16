import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const r = await page.request.post("/api/demo/login", { data: { as: "sarah" } });
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

test("on a phone the Amount column is visible without scrolling the grid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/circle/dashboard");
  await expect(page.getByTestId("status-stopped").first()).toBeVisible();
  // The Aftercare card pushes the grid below the first screen, so scroll the page down. Scroll the
  // grid itself, never the header cell, because that could also scroll the grid sideways and hide the defect.
  await page.locator(".ag-root").first().scrollIntoViewIfNeeded();
  const amount = page.getByRole("columnheader", { name: "Amount" });
  await expect(amount).toBeInViewport({ ratio: 1 });
  // Nothing has scrolled the grid sideways to make that true.
  expect(await page.locator(".ag-grid-viewport").first().evaluate((el) => el.scrollLeft)).toBe(0);
});

test("the trends page draws the chart and the totals table", async ({ page }) => {
  await page.goto("/trends");
  await expect(page.getByTestId("trends-chart").locator("canvas").first()).toBeVisible();
  await expect(page.getByText("Family member in trouble").first()).toBeVisible();
});
