import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { SCREENS } from "./screens";
import { PAYMENT_ID, stubPayment } from "./stubs";
import { mkdirSync } from "node:fs";

const VIEWPORTS = [
  { tag: "390", width: 390, height: 844 },
  { tag: "1280", width: 1280, height: 800 },
];
// When set, each screen is also saved as a screenshot (the final set). Never inside the repo.
const SHOTS = process.env.SHOTS_DIR;

for (const screen of SCREENS) {
  for (const vp of VIEWPORTS) {
    test(`axe: ${screen.name} at ${vp.tag}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      if (screen.as) await signInAs(page, screen.as);
      await screen.prepare(page);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
        `${screen.name} at ${vp.tag}`,
      ).toEqual([]);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/${screen.name}-${vp.tag}.png`, fullPage: true });
      }
    });
  }
}

async function heldScreen(page: Page, kind: "held" | "waiting") {
  await signInAs(page, "margaret");
  await stubPayment(page, kind);
  await page.goto(`/payments/${PAYMENT_ID}`);
  await page.getByTestId(`payment-screen-${kind}`).waitFor();
}

test.describe("keyboard", () => {
  test("the skip link is the first stop and moves focus to the main content", async ({ page }) => {
    await signInAs(page, "margaret");
    await page.goto("/home");
    await page.getByTestId("setup-card").waitFor();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("on /send every field can be reached by Tab, each with a visible outline", async ({ page }) => {
    await signInAs(page, "margaret");
    await page.goto("/send");
    await page.getByTestId("payee").waitFor();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { id: el.id, testid: el.dataset.testid ?? "", outline: getComputedStyle(el).outlineStyle };
      });
      seen.push(info.id || info.testid);
      // The amount input lives in a wrapper that draws the outline on focus-within.
      if (info.id !== "amount") expect(info.outline, `focus outline on ${info.id || info.testid}`).not.toBe("none");
      if (info.testid === "check") break;
    }
    expect(seen).toEqual(expect.arrayContaining(["payee", "amount", "answer", "note", "check"]));
  });
});

test.describe("reduced motion", () => {
  for (const kind of ["held", "waiting"] as const) {
    test(`the ${kind} screen runs no animations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await heldScreen(page, kind);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    });
  }
});

test.describe("zoom", () => {
  test("no horizontal scroll at 200% text on /home and the held screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = () => page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    await signInAs(page, "margaret");
    await page.goto("/home");
    await page.getByTestId("setup-card").waitFor();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await stubPayment(page, "held");
    await page.goto(`/payments/${PAYMENT_ID}`);
    await page.getByTestId("payment-screen-held").waitFor();
    expect(await overflow()).toBeLessThanOrEqual(1);
  });
});
