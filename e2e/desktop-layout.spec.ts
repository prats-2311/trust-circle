import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { PAYMENT_ID, STUB_PAYEE, VERIFY_ID, stubCircleReview, stubHighRiskPayment, stubVerify } from "./stubs";

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

test.describe("phone header", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function headerIsTidy(page: import("@playwright/test").Page) {
    const m = await page.evaluate(() => {
      const box = (el: Element | null) => {
        const r = el?.getBoundingClientRect();
        return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
      };
      const brand = document.querySelector('[data-testid="screen-brand"]');
      return {
        brandClipped: brand ? brand.scrollWidth > brand.clientWidth : null,
        brand: box(brand),
        back: box(document.querySelector('[data-testid="screen-back"]')),
        chip: box(document.querySelector('[data-testid="screen-chip"]')),
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    const hit = (a: { left: number; right: number; top: number; bottom: number } | null, b: typeof a) =>
      !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(m.chip).not.toBeNull();
    expect(hit(m.chip, m.back)).toBe(false);
    expect(hit(m.chip, m.brand)).toBe(false);
    expect(m.pageWidth).toBeLessThanOrEqual(390);
    return m;
  }

  test("Daniel's verify screen shows the whole brand and the status apart from it", async ({ page }) => {
    await signInAs(page, "daniel");
    await stubVerify(page, "ask");
    await page.goto(`/verify/${VERIFY_ID}`);
    await page.getByTestId("not-me").waitFor();
    const m = await headerIsTidy(page);
    expect(m.brand).not.toBeNull();
    expect(m.brandClipped).toBe(false);
  });

  test("Sarah's payment review shows the status apart from the back arrow", async ({ page }) => {
    await signInAs(page, "sarah");
    await stubCircleReview(page);
    await page.goto(`/circle/payments/${PAYMENT_ID}`);
    await page.getByTestId("screen-chip").waitFor();
    const m = await headerIsTidy(page);
    expect(m.back).not.toBeNull();
  });
});
