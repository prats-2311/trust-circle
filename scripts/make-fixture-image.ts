import { chromium } from "@playwright/test";

const html = `<!doctype html><html><body style="margin:0;background:#f2f2f7;font-family:-apple-system,Helvetica,Arial,sans-serif;width:390px">
<div style="padding:18px 16px 8px;text-align:center;color:#6b6b70;font-size:13px">+1 (415) 555-0199<br>Today 9:41 AM</div>
<div style="margin:8px 16px 24px;max-width:290px;background:#e5e5ea;color:#111;border-radius:18px;padding:10px 14px;font-size:16px;line-height:1.35">Hi Grandma it's me Daniel, I lost my phone so this is my new number. I'm in trouble and need $800 in gift cards today. Please don't tell mom, I'll explain later.</div>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 260 } });
  await page.setContent(html);
  await page.screenshot({ path: "fixtures/scam-sms.png" });
  await browser.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
});
