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

const PLAIN_HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * True only for a canonical https URL on a known push service: no credentials, no port, a plain
 * lower-case hostname, and the raw string equal to its own href. Canonical form means the legacy
 * url.parse that web-push connects with sees the same host we checked.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    PLAIN_HOSTNAME.test(url.hostname) &&
    isPushHost(url.hostname) &&
    endpoint === url.href
  );
}

/** A browser PushSubscription as JSON, narrowed to the fields we store. Returns null for anything else. */
export function parsePushSub(x: unknown): PushSub | null {
  if (typeof x !== "object" || x === null) return null;
  const { endpoint, keys } = x as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  if (!isAllowedPushEndpoint(endpoint)) return null;
  if (typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (!key(p256dh) || !key(auth)) return null;
  return { endpoint: new URL(endpoint).href, keys: { p256dh, auth } };
}
