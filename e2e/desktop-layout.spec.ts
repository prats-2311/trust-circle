import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { STUB_PAYEE, stubHighRiskPayment } from "./stubs";

test.describe("desktop layout", () => {
  test.use({ viewport: { width: 1280, height: 1200 } });

  test("on desktop the actions sit just under the content", async ({ page }) => {
    await signInAs(page, "margaret");
    await stubHighRiskPayment(page);
    await page.goto("/send");
    await page.getByLabel("Who are you paying?").fill(STUB_PAYEE);
    await page.getByLabel("How much?").fill("800");
    await page.getByTestId("check").click();
    const body = page.getByTestId("risk-high");
    await body.waitFor();
    const gap = await page.evaluate(() => {
      const content = document.querySelector('[data-testid="risk-high"]')!;
      // The lowest visible text: a stretched wrapper's own box says nothing about where the content ends.
      let lastBottom = 0;
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        lastBottom = Math.max(lastBottom, range.getBoundingClientRect().bottom);
      }
      const main = document.querySelector("main")!;
      const footer = main.lastElementChild!.getBoundingClientRect();
      return footer.top - lastBottom;
    });
    expect(gap).toBeLessThan(120);
  });
});

test("phone keeps the actions at the bottom of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "margaret");
  await page.goto("/check");
  const bottomGap = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    return window.innerHeight - main.lastElementChild!.getBoundingClientRect().bottom;
  });
  expect(bottomGap).toBeLessThan(60);
});

test("the home screen mentions voice notes", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/home");
  await expect(page.getByTestId("home-check")).toContainText("Paste a text, or add a screenshot or a voice note. We'll tell you if it looks like a scam.");
});

test("API answers are never cached", async ({ page }) => {
  await signInAs(page, "sarah");
  const r = await page.request.get("/api/circle/dashboard/paypal");
  expect(r.headers()["cache-control"]).toContain("no-store");
});
