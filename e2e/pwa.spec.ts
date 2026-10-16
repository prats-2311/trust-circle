import { expect, test } from "@playwright/test";

// New headless Chromium: the old headless shell refuses notification permission.
test.use({ channel: "chromium" });

test("the manifest makes the app installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
  }
});

test("sw.js is never cached", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.ok()).toBe(true);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(res.headers()["content-type"]).toContain("application/javascript");
  expect(res.headers()["content-security-policy"]).toBe("default-src 'self'; script-src 'self'");
});

test("the service worker registers", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()))).toBe(true);
});

test("a push shows a notification, even when its url points elsewhere", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["notifications"], { origin: new URL(baseURL!).origin });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
      const hit = e.registrations.find((r) => r.scopeURL.startsWith(baseURL!));
      if (hit) resolve(hit.registrationId);
    });
  });
  await cdp.send("ServiceWorker.enable");

  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(baseURL!).origin,
    registrationId: await registrationId,
    data: JSON.stringify({ title: "T", body: "B", url: "https://evil.example/x", tag: "t" }),
  });

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.getNotifications()).map((n) => n.title);
      }),
    )
    .toContain("T");
});
