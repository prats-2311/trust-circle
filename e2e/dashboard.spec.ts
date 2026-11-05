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

test("desktop grid has a PayPal says column", async ({ page }) => {
  await page.goto("/circle/dashboard");
  await expect(page.getByRole("columnheader", { name: "PayPal says" })).toBeVisible();
});

test("the details panel shows what PayPal says", async ({ page }) => {
  // Local seeded payments have no PayPal ids, so give every payment an answer.
  const dash = (await (await page.request.get("/api/circle/dashboard")).json()) as { rows: { id: string }[] };
  const says = Object.fromEntries(dash.rows.map((r) => [r.id, { label: "Voided", matches: true }]));
  await page.route("**/api/circle/dashboard/paypal", (r) => r.fulfill({ json: { says } }));
  await page.goto("/circle/dashboard");
  await page.getByTestId("status-stopped").first().click();
  const panel = page.getByTestId("payment-details");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "PayPal says" })).toBeVisible();
});

test("a failed PayPal check never leaves the panel waiting", async ({ page }) => {
  await page.route("**/api/circle/dashboard/paypal", (r) => r.fulfill({ status: 500, body: "{}" }));
  const answered = page.waitForResponse("**/api/circle/dashboard/paypal");
  await page.goto("/circle/dashboard");
  await answered;
  await page.getByTestId("status-stopped").first().click();
  const panel = page.getByTestId("payment-details");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("PayPal says")).toHaveCount(0);
  await expect(panel).not.toContainText("Checking with PayPal");
});

test("a mismatch is shown in full", async ({ page }) => {
  const dash = (await (await page.request.get("/api/circle/dashboard")).json()) as { rows: { id: string }[] };
  const says = Object.fromEntries(dash.rows.map((r) => [r.id, { label: "Voided", matches: false }]));
  await page.route("**/api/circle/dashboard/paypal", (r) => r.fulfill({ json: { says } }));
  await page.goto("/circle/dashboard");
  const chip = page.getByTestId("paypal-says-mismatch").first();
  await expect(chip).toBeVisible();
  const c = (await chip.boundingBox())!;
  const cell = (await chip.locator("xpath=ancestor::div[@role='gridcell']").boundingBox())!;
  expect(c.x).toBeGreaterThanOrEqual(cell.x);
  expect(c.x + c.width).toBeLessThanOrEqual(cell.x + cell.width);
  expect(c.y).toBeGreaterThanOrEqual(cell.y);
  expect(c.y + c.height).toBeLessThanOrEqual(cell.y + cell.height);
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

test("on desktop the dashboard has an explore board", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/circle/dashboard");
  await expect(page.getByRole("heading", { name: "Explore your circle's payments" })).toBeVisible();
  await expect(page.getByText("Payments by scam type").first()).toBeVisible();
  await expect(page.getByTestId("payments-grid")).toBeVisible();
  await expect(page.getByTestId("status-stopped").first()).toBeVisible();
});

test("at tablet width the explore board renders without scrolling the page", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/circle/dashboard");
  await expect(page.getByText("Payments by scam type").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
});

test("on a phone the explore board isn't loaded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/circle/dashboard");
  await expect(page.getByTestId("money-protected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore your circle's payments" })).toHaveCount(0);
  await expect(page.getByTestId("payments-grid")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("the explore board's widgets follow the filters", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/circle/dashboard");
  const money = page.getByTestId("studio-money-protected");
  await expect(money).toContainText("Money protected");
  const before = await money.innerText();
  await expect(page.getByTestId("studio-paypal-check")).toContainText("Matches PayPal");
  // Keep only one status that isn't "Stopped": the stopped money drops out of the total.
  const board = page.locator("[data-testid=studio-board], body");
  await board.first().getByText("Sent", { exact: true }).first().click();
  await expect.poll(() => money.innerText()).not.toBe(before);
});
