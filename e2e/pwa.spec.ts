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
  const worker = context.serviceWorkers()[0]!;

  // Watch what the worker asks the browser to show. We do not read the notification back with
  // getNotifications(): headless Chromium keeps notification state in a store shared across
  // test contexts (same origin, same registration id), so every other run's notification is
  // dropped and that read-back is empty for the full timeout, whatever the worker did.
  await worker.evaluate(() => {
    const w = self as unknown as {
      __shown: { title: string; options?: NotificationOptions }[];
      registration: ServiceWorkerRegistration;
    };
    w.__shown = [];
    const show = w.registration.showNotification.bind(w.registration);
    w.registration.showNotification = (title: string, options?: NotificationOptions) => {
      w.__shown.push({ title, options });
      return show(title, options);
    };
  });

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
    .poll(() => worker.evaluate(() => (self as unknown as { __shown: { title: string }[] }).__shown.map((n) => n.title)))
    .toEqual(["T"]);
  const shown = (await worker.evaluate(() => (self as unknown as { __shown: { options: NotificationOptions }[] }).__shown))[0]!;
  expect(shown.options).toMatchObject({ body: "B", tag: "t", data: { url: "https://evil.example/x" } });
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
      const endpoint = "https://fcm.googleapis.com/fcm/send/e2e";
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
    expect(posted!.endpoint).toBe("https://fcm.googleapis.com/fcm/send/e2e");
  });
});

test.describe("signing out", () => {
  test("takes this device off the account's push list first", async ({ page }) => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/e2e";
    await page.addInitScript((ep) => {
      const sub = { endpoint: ep, toJSON: () => ({ endpoint: ep }), unsubscribe: async () => true };
      PushManager.prototype.getSubscription = async () => sub as unknown as PushSubscription;
    }, endpoint);
    let deleted: { endpoint?: string } | null = null;
    await page.route("**/api/push/subscription", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      deleted = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await signInAs(page, "margaret");
    await page.goto("/home");
    await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()))).toBe(true);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/$/);
    expect(deleted).toEqual({ endpoint });
  });
});
