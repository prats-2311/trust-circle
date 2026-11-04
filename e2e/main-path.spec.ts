import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { VERIFY_ID, stubCircleReview } from "./stubs";

const EXAMPLE =
  "Hi Grandma it's me, I lost my phone so this is my new number. I need $800 in gift cards today. Please don't tell mom. Text me at +1 (415) 555-0199";

test("the landing shows the three main buttons in order, with the rest under Also built", async ({ page }) => {
  await page.goto("/");
  const primary = page.locator("#try > div > div").first().getByRole("button");
  await expect(primary).toHaveText(["Try as Margaret", "Try as Daniel, her grandson", "Try as Sarah, her daughter"]);
  const more = page.getByText("Also built: business and edge cases");
  await more.click();
  for (const n of ["Priya", "Tom", "Robert"]) await expect(page.getByTestId(`try-${n.toLowerCase()}`)).toBeVisible();
  await expect(page.getByText("Other demo accounts")).toHaveCount(0);
});

test("the landing steps name who to be, and the footer links to Scam trends", async ({ page }) => {
  await page.goto("/");
  const steps = page.locator("ol > li");
  await expect(steps.nth(0)).toContainText("Step 1 · as Margaret");
  await expect(steps.nth(1)).toContainText("Step 2 · as Margaret");
  await expect(steps.nth(2)).toContainText("Step 3 · as Daniel");
  await expect(steps.nth(3)).toContainText("Step 4");
  await expect(steps.nth(3)).not.toContainText("as ");
  await expect(steps.nth(0)).not.toContainText("(as ");
  await expect(page.locator("footer").getByRole("link", { name: "Scam trends" })).toHaveAttribute("href", "/trends");
});

test("the landing buttons fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("try-daniel")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("/circle has no Scam trends link but keeps See all payments", async ({ page }) => {
  await signInAs(page, "sarah");
  await page.goto("/circle");
  await expect(page.getByRole("link", { name: "See all payments" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Scam trends" })).toHaveCount(0);
});

test("a pending request comes first in Needs you", async ({ page }) => {
  await signInAs(page, "daniel");
  await stubCircleReview(page);
  await page.route("**/api/alerts", (r) =>
    r.fulfill({
      json: [{ id: "v1", kind: "verify_request", title: "Did you just ask Margaret for $800?", body: "", path: `/verify/${VERIFY_ID}`, createdAt: new Date().toISOString(), readAt: null }],
    }),
  );
  await page.goto("/circle");
  const cards = page.locator("h2:has-text('Needs you') + div > *");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Did you just ask Margaret for $800?");
  await expect(cards.nth(1)).toContainText("Review the payment");
});

test("Try an example message fills the box and does not submit", async ({ page }) => {
  await signInAs(page, "margaret");
  let posted = false;
  await page.route("**/api/messages/check", (r) => { posted = true; return r.abort(); });
  await page.goto("/check");
  await page.getByRole("button", { name: "Try an example message" }).click();
  await expect(page.getByLabel("The message")).toHaveValue(EXAMPLE);
  expect(posted).toBe(false);
});
