export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const key = (v: unknown): v is string => typeof v === "string" && v.length <= 256 && BASE64URL.test(v);

/** A browser PushSubscription as JSON, narrowed to the fields we store. Returns null for anything else. */
export function parsePushSub(x: unknown): PushSub | null {
  if (typeof x !== "object" || x === null) return null;
  const { endpoint, keys } = x as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  try {
    if (new URL(endpoint).protocol !== "https:") return null;
  } catch {
    return null;
  }
  if (typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (!key(p256dh) || !key(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}
