// Trust Circle service worker: shows push alerts and opens our own pages on click.
// No fetch handler on purpose: nothing is cached, so stale data is never shown.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Verbatim copy of src/ui/swTarget.ts (the tested copy). Keep the two identical.
function safeTarget(url, origin) {
  if (typeof url !== "string") return "/";
  try {
    const u = new URL(url, origin);
    if (u.origin !== origin) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  const p = payload && typeof payload === "object" ? payload : {};
  const title = typeof p.title === "string" && p.title ? p.title : "Trust Circle";
  const body = typeof p.body === "string" && p.body ? p.body : "Something in your circle needs a look.";
  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: typeof p.url === "string" ? p.url : "/" },
  };
  if (typeof p.tag === "string") options.tag = p.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      const open = all.find((c) => new URL(c.url).origin === self.location.origin);
      if (open && "navigate" in open) return open.navigate(target).then((c) => (c || open).focus());
      return self.clients.openWindow(target);
    }),
  );
});
