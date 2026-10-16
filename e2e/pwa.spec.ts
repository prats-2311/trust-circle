import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

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

test.describe("opting in to notifications", () => {
  test.use({ permissions: ["notifications"] });

  test("turning on alerts sends this device's subscription to the server", async ({ page }) => {
    await page.route("**/api/push/config", (route) =>
      route.fulfill({
        json: { publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" },
      }),
    );
    await page.addInitScript(() => {
      let sub: unknown = null;
      const endpoint = "https://push.example/e2e";
      PushManager.prototype.subscribe = async () => {
        sub = {
          endpoint,
          toJSON: () => ({
            endpoint,
            keys: {
              p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
              auth: "tBHItJI5svbpez7KI4CCXg",
            },
          }),
          unsubscribe: async () => true,
        };
        return sub as PushSubscription;
      };
      PushManager.prototype.getSubscription = async () => sub as PushSubscription | null;
    });
    let posted: { endpoint?: string } | null = null;
    await page.route("**/api/push/subscription", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ok: true } });
    });

    await signInAs(page, "sarah");
    await page.goto("/settings");
    const card = page.getByTestId("notifications");
    await expect(card).toHaveAttribute("data-state", "ask");
    await page.getByTestId("notifications-action").click();

    await expect(card).toHaveAttribute("data-state", "on");
    expect(posted).not.toBeNull();
    expect(posted!.endpoint).toBe("https://push.example/e2e");
  });
});
