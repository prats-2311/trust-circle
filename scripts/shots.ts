/**
 * Screenshot every screen in e2e/screens.ts at phone and desktop size.
 * Usage: npx tsx scripts/shots.ts --base http://localhost:3999 --out <dir outside the repo>
 * Run it against a production build so the dev badge never appears. Network stubs come from e2e/stubs.ts.
 */
import { mkdirSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { chromium } from "@playwright/test";
import { SCREENS } from "../e2e/screens";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = arg("base");
const outArg = arg("out");
if (!base || !outArg) {
  console.error("Usage: npx tsx scripts/shots.ts --base <url> --out <dir>");
  process.exit(2);
}
const out = resolve(outArg);
const rel = relative(process.cwd(), out);
if (rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"))) {
  console.error("--out must be outside the repo");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1280", width: 1280, height: 800 },
];

async function main() {
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const vp of VIEWPORTS) {
      for (const screen of SCREENS) {
        const context = await browser.newContext({ baseURL: base, viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        try {
          if (screen.as) {
            const r = await page.request.post("/api/demo/login", { data: { as: screen.as } });
            if (!r.ok()) throw new Error(`sign-in as ${screen.as} failed (${r.status()})`);
          }
          await screen.prepare(page);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          await page.screenshot({ path: join(out, `${screen.name}-${vp.label}.png`), fullPage: true });
          console.log(`${screen.name}-${vp.label}${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ""}`);
          if (overflow > 0) failed++;
        } catch (e) {
          failed++;
          console.error(`${screen.name}-${vp.label} FAILED: ${(e as Error).message.split("\n")[0]}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}

void main();
