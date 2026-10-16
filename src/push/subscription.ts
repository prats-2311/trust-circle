export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const key = (v: unknown): v is string => typeof v === "string" && v.length <= 256 && BASE64URL.test(v);

const PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_DOMAINS = ["push.apple.com", "notify.windows.com"];

/** Match on the whole hostname (or a real subdomain), never a substring. */
function isPushHost(host: string): boolean {
  return PUSH_HOSTS.has(host) || PUSH_DOMAINS.some((d) => host.endsWith(`.${d}`));
}

/** A browser PushSubscription as JSON, narrowed to the fields we store. Returns null for anything else. */
export function parsePushSub(x: unknown): PushSub | null {
  if (typeof x !== "object" || x === null) return null;
  const { endpoint, keys } = x as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || !isPushHost(url.hostname)) return null;
  } catch {
    return null;
  }
  if (typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (!key(p256dh) || !key(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}
