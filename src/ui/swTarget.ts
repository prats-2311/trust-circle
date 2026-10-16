/**
 * Where a notification click may open: a path on our own origin, or "/".
 * public/sw.js holds a verbatim copy of this body (a service worker cannot import),
 * and the test reads sw.js to keep the two identical.
 */
export function safeTarget(url: unknown, origin: string): string {
  if (typeof url !== "string") return "/";
  try {
    const u = new URL(url, origin);
    if (u.origin !== origin) return "/";
    const path = u.pathname + u.search + u.hash;
    // "//host" would be read as another site, so only a single leading slash is allowed.
    return path.startsWith("//") ? "/" : path;
  } catch {
    return "/";
  }
}
