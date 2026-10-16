// Draws the Trust Circle mark (a ring around a person) at every size we ship.
// Run with: npm run icons
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const EVERGREEN = "#1E5A47";

type Kind = "rounded" | "full-bleed" | "badge";

function svg(size: number, kind: Kind): string {
  const c = size / 2;
  const r = size * 0.28;
  const stroke = size * 0.09;
  // Gap of 50 degrees centred at the top-right (45 degrees clockwise from the top).
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  };
  const ring = `<path d="M ${at(70)} A ${r} ${r} 0 1 1 ${at(20)}" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>`;
  const dot = `<circle cx="${c}" cy="${c}" r="${size * 0.06}" fill="#fff"/>`;
  const bg =
    kind === "badge"
      ? ""
      : `<rect width="${size}" height="${size}" rx="${kind === "rounded" ? size * 0.22 : 0}" fill="${EVERGREEN}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${ring}${kind === "badge" ? "" : dot}</svg>`;
}

const TARGETS: { file: string; size: number; kind: Kind }[] = [
  { file: "public/icons/icon-192.png", size: 192, kind: "rounded" },
  { file: "public/icons/icon-512.png", size: 512, kind: "rounded" },
  // Maskable: full-bleed background; the mark already sits well inside the central 80%.
  { file: "public/icons/icon-maskable-512.png", size: 512, kind: "full-bleed" },
  { file: "public/icons/badge-96.png", size: 96, kind: "badge" },
  // iOS rounds the apple icon itself, so it is full-bleed.
  { file: "src/app/apple-icon.png", size: 180, kind: "full-bleed" },
  { file: "src/app/icon.png", size: 32, kind: "rounded" },
];

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, "public/icons"), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const t of TARGETS) {
      const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
      await page.setContent(`<body style="margin:0;background:transparent">${svg(t.size, t.kind)}</body>`);
      await page.screenshot({ path: join(root, t.file), omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
      await page.close();
      console.log(`wrote ${t.file} (${t.size}px)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
