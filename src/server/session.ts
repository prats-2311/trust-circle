import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 12 * 3_600_000;

function mac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSession(userId: string, secret: string, now: Date = new Date(), ttlMs: number = SESSION_TTL_MS): string {
  const payload = `${userId}.${now.getTime() + ttlMs}`;
  return `${payload}.${mac(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now: Date = new Date()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, given] = parts as [string, string, string];
  if (!userId || !/^\d+$/.test(expires)) return null;
  const expected = Buffer.from(mac(`${userId}.${expires}`, secret));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return Number(expires) > now.getTime() ? userId : null;
}
